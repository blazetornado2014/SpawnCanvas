/**
 * SpawnCanvas History Manager
 * Handles undo/redo with per-workspace persistent history.
 */

const HistoryManager = (function() {
  'use strict';

  const MAX_HISTORY = 42;
  const STORAGE_PREFIX = 'spawncanvas_history_';

  // Per-workspace history stacks
  let undoStack = [];
  let redoStack = [];
  let currentWorkspaceId = null;
  let isRestoring = false; // Flag to prevent saving state during undo/redo

  /**
   * Check if chrome.storage API is available
   */
  function isStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  /**
   * Deep clone an object
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Get storage key for a workspace's history
   */
  function getStorageKey(workspaceId) {
    return STORAGE_PREFIX + workspaceId;
  }

  /**
   * Load history from storage for a workspace
   */
  async function loadHistory(workspaceId) {
    if (!isStorageAvailable()) {
      console.warn('[History] Chrome storage not available');
      undoStack = [];
      redoStack = [];
      currentWorkspaceId = workspaceId;
      return;
    }
    try {
      const key = getStorageKey(workspaceId);
      const result = await chrome.storage.local.get(key);
      const data = result[key];
      if (data) {
        undoStack = data.undoStack || [];
        redoStack = data.redoStack || [];
      } else {
        undoStack = [];
        redoStack = [];
      }
      currentWorkspaceId = workspaceId;
      console.log(`[History] Loaded history for workspace: ${workspaceId} (${undoStack.length} undo, ${redoStack.length} redo)`);
    } catch (err) {
      console.error('[History] Error loading history:', err);
      undoStack = [];
      redoStack = [];
    }
  }

  /**
   * Save history to storage
   */
  async function saveHistory() {
    if (!currentWorkspaceId) return;
    if (!isStorageAvailable()) {
      console.warn('[History] Chrome storage not available, history not persisted');
      return;
    }
    try {
      const key = getStorageKey(currentWorkspaceId);
      await chrome.storage.local.set({
        [key]: {
          undoStack: undoStack,
          redoStack: redoStack
        }
      });
    } catch (err) {
      console.error('[History] Error saving history:', err);
    }
  }

  /**
   * Push current state to undo stack
   * @param {Array} items - Current items array from Store
   */
  function push(items) {
    if (isRestoring) return; // Don't save state during undo/redo operations

    const state = deepClone(items);
    undoStack.push(state);

    // Trim to max history
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    // Clear redo stack on new action
    redoStack = [];

    // Persist history
    saveHistory();

    console.log(`[History] Pushed state (${undoStack.length} undo states)`);
  }

  /**
   * Undo last action
   * @param {Array} currentItems - Current items array from Store
   * @returns {Array|null} Previous state to restore, or null if nothing to undo
   */
  function undo(currentItems) {
    if (undoStack.length === 0) {
      console.log('[History] Nothing to undo');
      return null;
    }

    // Save current state to redo stack
    redoStack.push(deepClone(currentItems));

    // Pop from undo stack
    const previousState = undoStack.pop();

    // Persist history
    saveHistory();

    console.log(`[History] Undo (${undoStack.length} undo, ${redoStack.length} redo)`);
    return previousState;
  }

  /**
   * Redo last undone action
   * @param {Array} currentItems - Current items array from Store
   * @returns {Array|null} Next state to restore, or null if nothing to redo
   */
  function redo(currentItems) {
    if (redoStack.length === 0) {
      console.log('[History] Nothing to redo');
      return null;
    }

    // Save current state to undo stack
    undoStack.push(deepClone(currentItems));

    // Pop from redo stack
    const nextState = redoStack.pop();

    // Persist history
    saveHistory();

    console.log(`[History] Redo (${undoStack.length} undo, ${redoStack.length} redo)`);
    return nextState;
  }

  /**
   * Check if undo is available
   */
  function canUndo() {
    return undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  function canRedo() {
    return redoStack.length > 0;
  }

  /**
   * Set restoring flag (prevents push during undo/redo)
   */
  function setRestoring(value) {
    isRestoring = value;
  }

  /**
   * Clear history for current workspace
   */
  function clear() {
    undoStack = [];
    redoStack = [];
    saveHistory();
  }

  /**
   * Delete history for a workspace (call when workspace is deleted)
   */
  async function deleteWorkspaceHistory(workspaceId) {
    if (!isStorageAvailable()) return;
    try {
      const key = getStorageKey(workspaceId);
      await chrome.storage.local.remove(key);
      console.log(`[History] Deleted history for workspace: ${workspaceId}`);
    } catch (err) {
      console.error('[History] Error deleting history:', err);
    }
  }

  return {
    loadHistory,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    setRestoring,
    clear,
    deleteWorkspaceHistory
  };

})();

window.HistoryManager = HistoryManager;
