/**
 * SpawnCanvas Store
 * State management with Pub/Sub pattern and chrome.storage.local persistence.
 */

const Store = (function() {
  'use strict';

  // Storage key prefixes
  const STORAGE_PREFIX = 'spawncanvas_';
  const WORKSPACES_LIST_KEY = STORAGE_PREFIX + 'workspaces_list';
  const CURRENT_WORKSPACE_KEY = STORAGE_PREFIX + 'current_workspace';
  const WORKSPACE_PREFIX = STORAGE_PREFIX + 'workspace_';

  // Default workspace
  const DEFAULT_WORKSPACE_ID = 'default';
  const DEFAULT_WORKSPACE_NAME = 'Default Workspace';

  // Debounce delay for auto-save (ms)
  const SAVE_DEBOUNCE_MS = 300;

  // State
  let currentWorkspace = null;
  let saveTimeout = null;
  let isInitialized = false;

  // Pub/Sub listeners
  const listeners = new Map();

  // ============================================
  // PUB/SUB SYSTEM
  // ============================================

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  function on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  function off(event, callback) {
    if (listeners.has(event)) {
      listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  function emit(event, data) {
    if (listeners.has(event)) {
      listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[Store] Error in event listener for "${event}":`, err);
        }
      });
    }
  }

  // ============================================
  // WORKSPACE MANAGEMENT
  // ============================================

  /**
   * Generate a workspace ID from name
   * @param {string} name - Workspace name
   * @returns {string} Workspace ID
   */
  function generateWorkspaceId(name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 30);
    const random = Math.random().toString(36).substring(2, 8);
    return `${slug}_${random}`;
  }

  /**
   * Create a new workspace object
   * @param {string} id - Workspace ID
   * @param {string} name - Workspace name
   * @returns {object} Workspace object
   */
  function createWorkspaceObject(id, name) {
    return {
      id,
      name,
      viewportX: 0,
      viewportY: 0,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Get list of all workspace IDs
   * @returns {Promise<string[]>} Array of workspace IDs
   */
  async function getWorkspaceList() {
    try {
      const result = await chrome.storage.local.get(WORKSPACES_LIST_KEY);
      return result[WORKSPACES_LIST_KEY] || [DEFAULT_WORKSPACE_ID];
    } catch (err) {
      console.error('[Store] Error getting workspace list:', err);
      return [DEFAULT_WORKSPACE_ID];
    }
  }

  /**
   * Get all workspaces with their names
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async function getWorkspaces() {
    const ids = await getWorkspaceList();
    const workspaces = [];
    
    for (const id of ids) {
      const workspace = await loadWorkspaceData(id);
      if (workspace) {
        workspaces.push({ id: workspace.id, name: workspace.name });
      }
    }
    
    return workspaces;
  }

  /**
   * Load workspace data from storage
   * @param {string} id - Workspace ID
   * @returns {Promise<object|null>} Workspace data or null
   */
  async function loadWorkspaceData(id) {
    try {
      const key = WORKSPACE_PREFIX + id;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (err) {
      console.error(`[Store] Error loading workspace "${id}":`, err);
      return null;
    }
  }

  /**
   * Check if chrome.storage API is available
   */
  function isStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  /**
   * Save workspace data to storage
   * @param {object} workspace - Workspace data
   */
  async function saveWorkspaceData(workspace) {
    if (!isStorageAvailable()) {
      console.warn('[Store] Chrome storage not available (extension context may be invalidated)');
      return;
    }
    try {
      const key = WORKSPACE_PREFIX + workspace.id;
      await chrome.storage.local.set({ [key]: workspace });
    } catch (err) {
      console.error(`[Store] Error saving workspace "${workspace.id}":`, err);
    }
  }

  /**
   * Create a new workspace
   * @param {string} name - Workspace name
   * @returns {Promise<object>} New workspace object
   */
  async function createWorkspace(name) {
    const id = generateWorkspaceId(name);
    const workspace = createWorkspaceObject(id, name);
    
    // Save the workspace
    await saveWorkspaceData(workspace);
    
    // Add to workspace list
    const list = await getWorkspaceList();
    if (!list.includes(id)) {
      list.push(id);
      await chrome.storage.local.set({ [WORKSPACES_LIST_KEY]: list });
    }
    
    emit('workspace:created', workspace);
    return workspace;
  }

  /**
   * Rename a workspace
   * @param {string} id - Workspace ID
   * @param {string} newName - New name for the workspace
   * @returns {Promise<boolean>} Success
   */
  async function renameWorkspace(id, newName) {
    const workspace = await loadWorkspaceData(id);
    if (!workspace) return false;

    workspace.name = newName;
    workspace.updatedAt = Date.now();
    await saveWorkspaceData(workspace);

    // Update current workspace if it's the one being renamed
    if (currentWorkspace && currentWorkspace.id === id) {
      currentWorkspace.name = newName;
    }

    emit('workspace:renamed', { id, name: newName });
    return true;
  }

  /**
   * Delete a workspace
   * @param {string} id - Workspace ID to delete
   * @returns {Promise<string|null>} ID of workspace to switch to, or null if failed
   */
  async function deleteWorkspace(id) {
    const list = await getWorkspaceList();

    // Don't delete if it's the only workspace
    if (list.length <= 1) {
      console.warn('[Store] Cannot delete the last workspace');
      return null;
    }

    // Remove from list
    const index = list.indexOf(id);
    if (index === -1) return null;

    list.splice(index, 1);
    await chrome.storage.local.set({ [WORKSPACES_LIST_KEY]: list });

    // Remove workspace data
    const key = WORKSPACE_PREFIX + id;
    await chrome.storage.local.remove(key);

    emit('workspace:deleted', { id });

    // Return the first available workspace to switch to
    return list[0];
  }

  /**
   * Switch to a different workspace
   * @param {string} id - Workspace ID to switch to
   * @returns {Promise<boolean>} Success
   */
  async function switchWorkspace(id) {
    // Save current workspace first
    if (currentWorkspace) {
      await saveNow();
    }
    
    // Load the target workspace
    let workspace = await loadWorkspaceData(id);
    
    // If workspace doesn't exist (e.g., default on first run), create it
    if (!workspace) {
      if (id === DEFAULT_WORKSPACE_ID) {
        workspace = createWorkspaceObject(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME);
        await saveWorkspaceData(workspace);
        
        // Ensure it's in the list
        const list = await getWorkspaceList();
        if (!list.includes(DEFAULT_WORKSPACE_ID)) {
          list.unshift(DEFAULT_WORKSPACE_ID);
          await chrome.storage.local.set({ [WORKSPACES_LIST_KEY]: list });
        }
      } else {
        console.error(`[Store] Workspace "${id}" not found`);
        return false;
      }
    }
    
    currentWorkspace = workspace;
    
    // Save current workspace ID
    await chrome.storage.local.set({ [CURRENT_WORKSPACE_KEY]: id });
    
    emit('workspace:switched', currentWorkspace);
    return true;
  }

  /**
   * Get current workspace
   * @returns {object|null} Current workspace
   */
  function getCurrentWorkspace() {
    return currentWorkspace;
  }

  /**
   * Get current workspace ID from storage
   * @returns {Promise<string>} Current workspace ID
   */
  async function getCurrentWorkspaceId() {
    try {
      const result = await chrome.storage.local.get(CURRENT_WORKSPACE_KEY);
      return result[CURRENT_WORKSPACE_KEY] || DEFAULT_WORKSPACE_ID;
    } catch (err) {
      return DEFAULT_WORKSPACE_ID;
    }
  }

  // ============================================
  // ITEM CRUD OPERATIONS
  // ============================================

  /**
   * Generate a unique item ID
   * @returns {string} Item ID
   */
  function generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a new item
   * @param {string} type - Item type ('note', 'checklist', 'container')
   * @param {object} data - Item data
   * @returns {object} Created item
   */
  function createItem(type, data = {}) {
    if (!currentWorkspace) {
      console.error('[Store] No workspace loaded');
      return null;
    }

    const item = {
      id: generateItemId(),
      type,
      title: data.title || '',
      position: data.position || { x: 2500, y: 2500 },
      size: data.size || { width: 250, height: 180 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...data
    };

    // Type-specific defaults
    if (type === 'note') {
      item.content = data.content || '';
    } else if (type === 'checklist') {
      item.items = data.items || [];
    } else if (type === 'container') {
      item.color = data.color || 'blue';
      item.children = data.children || [];
    }

    currentWorkspace.items.push(item);
    currentWorkspace.updatedAt = Date.now();

    emit('item:created', item);
    scheduleSave();

    return item;
  }

  /**
   * Update an existing item
   * @param {string} id - Item ID
   * @param {object} changes - Changes to apply
   * @returns {object|null} Updated item or null
   */
  function updateItem(id, changes) {
    if (!currentWorkspace) return null;

    const index = currentWorkspace.items.findIndex(item => item.id === id);
    if (index === -1) return null;

    const item = currentWorkspace.items[index];
    
    // Apply changes
    Object.assign(item, changes, { updatedAt: Date.now() });
    currentWorkspace.updatedAt = Date.now();

    emit('item:updated', item);
    scheduleSave();

    return item;
  }

  /**
   * Delete an item
   * @param {string} id - Item ID
   * @returns {boolean} Success
   */
  function deleteItem(id) {
    if (!currentWorkspace) return false;

    const index = currentWorkspace.items.findIndex(item => item.id === id);
    if (index === -1) return false;

    const [deletedItem] = currentWorkspace.items.splice(index, 1);
    currentWorkspace.updatedAt = Date.now();

    emit('item:deleted', deletedItem);
    scheduleSave();

    return true;
  }

  /**
   * Get an item by ID
   * @param {string} id - Item ID
   * @returns {object|null} Item or null
   */
  function getItem(id) {
    if (!currentWorkspace) return null;
    return currentWorkspace.items.find(item => item.id === id) || null;
  }

  /**
   * Get all items in current workspace
   * @returns {array} Array of items
   */
  function getAllItems() {
    if (!currentWorkspace) return [];
    return [...currentWorkspace.items];
  }

  // ============================================
  // VIEWPORT MANAGEMENT
  // ============================================

  /**
   * Update viewport position
   * @param {number} x - Viewport X offset
   * @param {number} y - Viewport Y offset
   */
  function updateViewport(x, y) {
    if (!currentWorkspace) return;
    
    currentWorkspace.viewportX = x;
    currentWorkspace.viewportY = y;
    currentWorkspace.updatedAt = Date.now();
    
    scheduleSave();
  }

  /**
   * Get viewport position
   * @returns {{x: number, y: number}} Viewport position
   */
  function getViewport() {
    if (!currentWorkspace) return { x: 0, y: 0 };
    return {
      x: currentWorkspace.viewportX || 0,
      y: currentWorkspace.viewportY || 0
    };
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  /**
   * Schedule a debounced save
   */
  function scheduleSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Save immediately (bypasses debounce)
   * @returns {Promise<void>}
   */
  async function saveNow() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    
    if (!currentWorkspace) return;
    
    try {
      await saveWorkspaceData(currentWorkspace);
      emit('workspace:saved', currentWorkspace);
      console.log('[Store] Workspace saved:', currentWorkspace.name);
    } catch (err) {
      console.error('[Store] Error saving workspace:', err);
    }
  }

  /**
   * Initialize the store - load current workspace
   * @returns {Promise<object>} Current workspace
   */
  async function init() {
    if (isInitialized) {
      return currentWorkspace;
    }

    // Get current workspace ID
    const currentId = await getCurrentWorkspaceId();
    
    // Switch to it (will create default if needed)
    await switchWorkspace(currentId);
    
    // Set up beforeunload to save on page close
    window.addEventListener('beforeunload', () => {
      // Use synchronous approach for beforeunload
      if (currentWorkspace) {
        // Note: chrome.storage.local.set returns a promise, but we can't await in beforeunload
        // The browser should still process it, but it's not guaranteed
        saveNow();
      }
    });

    isInitialized = true;
    emit('store:initialized', currentWorkspace);
    console.log('[Store] Initialized with workspace:', currentWorkspace?.name);
    
    return currentWorkspace;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    // Pub/Sub
    on,
    off,
    emit,

    // Initialization
    init,

    // Workspace management
    getWorkspaceList,
    getWorkspaces,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
    getCurrentWorkspace,

    // Item CRUD
    createItem,
    updateItem,
    deleteItem,
    getItem,
    getAllItems,

    // Viewport
    updateViewport,
    getViewport,

    // Persistence
    save: scheduleSave,
    saveNow
  };

})();

// Export for use in other modules
window.Store = Store;
