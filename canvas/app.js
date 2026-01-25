/**
 * SpawnCanvas - Main Application Entry Point
 * Initializes the canvas application within the Shadow DOM
 */

class CanvasApp {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.wrapper = null;
    this.canvasArea = null;
    this.canvasSurface = null;
    this.workspaceSelector = null;

    // Pan state
    this.panOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isSpaceDown = false; // For Space+Drag panning

    // Selection state
    this.selectedItems = new Set();
    this.isSelecting = false;
    this.selectionStart = { x: 0, y: 0 };
    this.selectionBox = null;

    // Tab state
    this.activeTab = 'workspace'; // 'workspace' | 'memory'
    this.selectedProjectId = null;

    this.canvasSize = 5000;
    this.gridSize = 20;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleCanvasMouseDown = this.handleCanvasMouseDown.bind(this);
    this.handleCanvasMouseMove = this.handleCanvasMouseMove.bind(this);
    this.handleCanvasMouseUp = this.handleCanvasMouseUp.bind(this);
  }

  async init() {
    this.render();
    this.cacheElements();
    this.attachEventListeners();

    await Store.init();

    // Load history for current workspace
    const currentWorkspace = Store.getCurrentWorkspace();
    if (currentWorkspace) {
      await HistoryManager.loadHistory(currentWorkspace.id);
    }

    // Load saved viewport or reset to center
    const viewport = Store.getViewport();
    if (viewport.x !== 0 || viewport.y !== 0) {
      this.panOffset = { x: viewport.x, y: viewport.y };
      this.updateCanvasTransform();
    } else {
      this.resetView();
    }

    // Render existing items
    this.renderAllItems();

    // Populate workspace dropdown
    await this.populateWorkspaceDropdown();

    // Subscribe to store events
    this.subscribeToStoreEvents();

    console.log('[SpawnCanvas] App initialized');
  }

  subscribeToStoreEvents() {
    Store.on('workspace:switched', async () => {
      // Load history for new workspace
      const currentWorkspace = Store.getCurrentWorkspace();
      if (currentWorkspace) {
        await HistoryManager.loadHistory(currentWorkspace.id);
      }

      // Clear canvas and re-render
      this.clearCanvas();
      this.renderAllItems();

      // Restore viewport (reset to center as per phase3.md spec)
      this.resetView();

      // Update dropdown selection
      this.updateWorkspaceDropdownSelection();
    });
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'spawn-canvas-wrapper';
    this.wrapper.setAttribute('tabindex', '0');

    this.wrapper.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tab-container">
            <button class="tab-btn active" data-tab="workspace">Workspace</button>
            <button class="tab-btn" data-tab="memory">Memory</button>
          </div>
          <div class="workspace-controls">
            <select class="workspace-selector">
              <option value="default">Default Workspace</option>
            </select>
            <div class="settings-dropdown">
              <button class="settings-btn icon-btn" data-action="toggle-settings" title="Workspace Settings">⚙️</button>
              <div class="settings-menu">
                <button class="settings-menu-item" data-action="rename-workspace">✏️ Rename Workspace</button>
                <button class="settings-menu-item" data-action="delete-workspace">🗑️ Delete Workspace</button>
                <button class="settings-menu-item" data-action="export-workspace">📤 Export Workspace</button>
                <button class="settings-menu-item" data-action="export-all">📦 Export All Workspaces</button>
                <div class="settings-menu-divider"></div>
                <div class="settings-ai">
                  <label>🤖 AI Provider</label>
                  <select class="ai-provider-select">
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="gemini">Gemini (Google)</option>
                  </select>
                  <label>🔑 API Key</label>
                  <input type="password" class="api-key-input" placeholder="Enter API key...">
                  <button class="api-key-save" data-action="save-api-key">Save</button>
                </div>
              </div>
            </div>
            <button class="prompts-btn icon-btn" data-action="toggle-prompts" title="Edit AI Prompts">📝</button>
            <button class="add-btn" data-action="add-note">+ Note</button>
            <button class="add-btn" data-action="add-checklist">+ Checklist</button>
            <button class="add-btn" data-action="add-container">+ Container</button>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="undo-btn icon-btn" data-action="undo" title="Undo (Ctrl+Z)">↩️</button>
          <button class="redo-btn icon-btn" data-action="redo" title="Redo (Ctrl+Y)">↪️</button>
          <button class="close-btn icon-btn" data-action="close" title="Close (Esc)">×</button>
        </div>
      </div>
      <div class="canvas-area">
        <div class="canvas-surface">
          <div class="center-anchor"></div>
          <!-- Canvas items will be rendered here -->
        </div>
      </div>
      <div class="memory-area hidden">
        <div class="memory-sidebar">
          <div class="memory-sidebar-header">
            <h3>Projects</h3>
          </div>
          <div class="project-list">
            <!-- Project items will be rendered here -->
          </div>
        </div>
        <div class="memory-content">
          <div class="memory-content-header">
            <h3 class="memory-project-title">Select a project</h3>
            <button class="delete-project-btn hidden" data-action="delete-project" title="Delete Project">🗑️</button>
          </div>
          <div class="chat-history">
            <div class="chat-empty-state">
              <p>Select a project from the left panel to view its chat history.</p>
            </div>
          </div>
        </div>
      </div>
      <input type="file" class="import-file-input" accept=".json" style="display: none;">
      <div class="prompts-modal">
        <div class="prompts-modal-content">
          <div class="prompts-modal-header">
            <h3>AI Prompts</h3>
            <button class="prompts-modal-close" data-action="close-prompts">×</button>
          </div>
          <div class="prompts-modal-body">
            <div class="prompt-section">
              <label>Checklist Generation Prompt</label>
              <p class="prompt-hint">Use {prompt} as placeholder for user's input</p>
              <textarea class="prompt-textarea checklist-prompt" placeholder="Enter custom checklist system prompt..."></textarea>
              <button class="prompt-reset-btn" data-action="reset-checklist-prompt">Reset to Default</button>
            </div>
            <div class="prompt-section">
              <label>Note Expansion Prompt</label>
              <p class="prompt-hint">Use {prompt} as placeholder for user's input</p>
              <textarea class="prompt-textarea note-prompt" placeholder="Enter custom note system prompt..."></textarea>
              <button class="prompt-reset-btn" data-action="reset-note-prompt">Reset to Default</button>
            </div>
          </div>
          <div class="prompts-modal-footer">
            <button class="prompts-save-btn" data-action="save-prompts">Save</button>
          </div>
        </div>
      </div>
      <div class="ai-input-modal">
        <div class="ai-input-modal-content">
          <div class="ai-input-modal-header">
            <h3 class="ai-input-title">Generate with AI</h3>
            <button class="ai-input-modal-close" data-action="close-ai-input">×</button>
          </div>
          <div class="ai-input-modal-body">
            <label>What would you like to generate?</label>
            <textarea class="ai-input-textarea" placeholder="E.g., Create a checklist for planning a birthday party..."></textarea>
            <p class="ai-input-hint">Tip: Be specific about what you want. The item title will be used as context.</p>
          </div>
          <div class="ai-input-modal-footer">
            <button class="ai-input-cancel-btn" data-action="close-ai-input">Cancel</button>
            <button class="ai-input-submit-btn" data-action="submit-ai-input">Generate</button>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(this.wrapper);
  }

  cacheElements() {
    this.canvasArea = this.wrapper.querySelector('.canvas-area');
    this.canvasSurface = this.wrapper.querySelector('.canvas-surface');
    this.toolbar = this.wrapper.querySelector('.toolbar');
    this.workspaceSelector = this.wrapper.querySelector('.workspace-selector');
    this.workspaceControls = this.wrapper.querySelector('.workspace-controls');
    this.importFileInput = this.wrapper.querySelector('.import-file-input');
    this.settingsDropdown = this.wrapper.querySelector('.settings-dropdown');
    this.apiKeyInput = this.wrapper.querySelector('.api-key-input');
    this.aiProviderSelect = this.wrapper.querySelector('.ai-provider-select');
    this.promptsModal = this.wrapper.querySelector('.prompts-modal');
    this.checklistPromptTextarea = this.wrapper.querySelector('.checklist-prompt');
    this.notePromptTextarea = this.wrapper.querySelector('.note-prompt');
    this.aiInputModal = this.wrapper.querySelector('.ai-input-modal');
    this.aiInputTextarea = this.wrapper.querySelector('.ai-input-textarea');
    this.aiInputTitle = this.wrapper.querySelector('.ai-input-title');

    // Memory tab elements
    this.memoryArea = this.wrapper.querySelector('.memory-area');
    this.projectList = this.wrapper.querySelector('.project-list');
    this.chatHistory = this.wrapper.querySelector('.chat-history');
    this.memoryProjectTitle = this.wrapper.querySelector('.memory-project-title');
    this.deleteProjectBtn = this.wrapper.querySelector('.delete-project-btn');
    this.tabButtons = this.wrapper.querySelectorAll('.tab-btn');

    // State for AI input modal
    this.aiInputTarget = null; // { id: string, type: 'checklist' | 'note' }
  }

  attachEventListeners() {
    // Keyboard events on wrapper
    this.wrapper.addEventListener('keydown', this.handleKeyDown);

    // Capture Ctrl+Z/Y at document level when overlay is visible
    this._documentKeyHandler = (e) => {
      if (!this.wrapper.isConnected) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        } else {
          this.redo();
        }
      }
    };
    document.addEventListener('keydown', this._documentKeyHandler, true); // Use capture phase

    // Capture paste when nothing is focused (images or text)
    this._pasteHandler = async (e) => {
      if (!this.wrapper.isConnected) return;

      // Check if any editable element is focused (inside shadow DOM or document)
      const activeElement = this.shadowRoot.activeElement || document.activeElement;
      const isEditing = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      // Only intercept if nothing is being edited
      if (!isEditing) {
        e.preventDefault();
        e.stopPropagation();

        // Check for images first
        const clipboardItems = e.clipboardData?.items;
        if (clipboardItems) {
          for (const item of clipboardItems) {
            if (item.type.startsWith('image/')) {
              const blob = item.getAsFile();
              if (blob) {
                this.createImageFromPaste(blob);
                return;
              }
            }
          }
        }

        // Fall back to text paste
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            this.createNoteFromPaste(text.trim());
          }
        } catch (err) {
          console.error('[SpawnCanvas] Failed to read clipboard:', err);
        }
      }
    };
    document.addEventListener('paste', this._pasteHandler, true);

    // Track Space key for pan mode
    this._spaceKeyDownHandler = (e) => {
      if (!this.wrapper.isConnected) return;

      // Handle Shadow DOM retargeting
      const target = e.composedPath ? e.composedPath()[0] : e.target;
      const isInput = target.matches && (target.matches('input, textarea') || target.isContentEditable);

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        this.isSpaceDown = true;
        this.canvasArea.classList.add('pan-mode');
      }
    };
    this._spaceKeyUpHandler = (e) => {
      if (!this.wrapper.isConnected) return;
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        this.canvasArea.classList.remove('pan-mode');
      }
    };
    document.addEventListener('keydown', this._spaceKeyDownHandler);
    document.addEventListener('keyup', this._spaceKeyUpHandler);

    // Tab button clicks
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // Toolbar button clicks (delegated)
    this.toolbar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        this.handleToolbarAction(action);
        // Close settings menu after clicking a menu item (except toggle itself)
        if (action !== 'toggle-settings' && e.target.closest('.settings-menu')) {
          this.closeSettingsMenu();
        }
      }
    });

    // Memory area click handlers (delegated)
    this.memoryArea.addEventListener('click', (e) => {
      // Project item click
      const projectItem = e.target.closest('.project-item');
      if (projectItem) {
        this.selectProject(projectItem.dataset.projectId);
        return;
      }

      // Delete project button
      const deleteBtn = e.target.closest('[data-action="delete-project"]');
      if (deleteBtn && this.selectedProjectId) {
        this.deleteSelectedProject();
        return;
      }

      // Delete message button
      const deleteMessageBtn = e.target.closest('[data-action="delete-message"]');
      if (deleteMessageBtn) {
        const messageId = deleteMessageBtn.dataset.messageId;
        if (messageId && this.selectedProjectId) {
          this.deleteMessage(this.selectedProjectId, messageId);
        }
      }
    });

    // Close settings menu when clicking outside
    this.wrapper.addEventListener('click', (e) => {
      if (!e.target.closest('.settings-dropdown')) {
        this.closeSettingsMenu();
      }
    });

    // Handle prompts modal clicks (delegated)
    this.promptsModal.addEventListener('click', (e) => {
      // Close when clicking on the backdrop (not the content)
      if (e.target === this.promptsModal) {
        this.closePromptsModal();
        return;
      }

      // Handle action buttons
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        this.handleToolbarAction(action);
      }
    });

    // Handle AI input modal clicks (delegated)
    this.aiInputModal.addEventListener('click', (e) => {
      // Close when clicking on the backdrop
      if (e.target === this.aiInputModal) {
        this.closeAiInputModal();
        return;
      }

      // Handle action buttons
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        this.handleToolbarAction(action);
      }
    });

    // Handle Enter key in AI input textarea (Ctrl+Enter to submit)
    this.aiInputTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.submitAiInput();
      }
    });

    // Workspace selector
    this.workspaceSelector.addEventListener('change', (e) => {
      this.handleWorkspaceChange(e.target.value);
    });

    // Import file input
    this.importFileInput.addEventListener('change', (e) => {
      this.handleImportFile(e.target.files[0]);
      e.target.value = ''; // Reset so same file can be selected again
    });

    // Canvas panning
    this.canvasArea.addEventListener('mousedown', this.handleCanvasMouseDown);
    this.canvasArea.addEventListener('mousemove', this.handleCanvasMouseMove);
    this.canvasArea.addEventListener('mouseup', this.handleCanvasMouseUp);
    this.canvasArea.addEventListener('mouseleave', this.handleCanvasMouseUp);

    // Click on canvas to deselect
    this.canvasSurface.addEventListener('click', (e) => {
      if (e.target === this.canvasSurface || e.target.classList.contains('center-anchor')) {
        this.deselectAll();
      }
    });

    // ========================================
    // DELEGATED EVENT HANDLERS FOR CANVAS ITEMS
    // ========================================

    // Delegated mousedown for items (drag) and resize handles
    this.canvasSurface.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.canvas-item');
      if (!item) return;

      const itemId = item.dataset.itemId;

      // Handle resize handles
      if (e.target.classList.contains('resize-handle')) {
        e.stopPropagation();
        this.startResize(e, item, itemId, e.target);
        return;
      }

      // Don't start drag if clicking on input/textarea or buttons
      if (e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'BUTTON') {
        return;
      }

      // Select and start drag
      const isShiftClick = e.shiftKey;
      if (!this.selectedItems.has(itemId)) {
        this.selectItem(itemId, isShiftClick);
      }
      this.startDrag(e, item, itemId);
    });

    // Delegated click for buttons (delete, copy, color, add-checklist-item, delete-checklist-item)
    this.canvasSurface.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const item = e.target.closest('.canvas-item');
      if (!item) return;

      const itemId = item.dataset.itemId;
      e.stopPropagation();

      switch (action) {
        case 'delete':
          this.deleteItem(itemId);
          break;
        case 'copy':
          this.copyItemToClipboard(itemId);
          break;
        case 'cycle-color':
          this.cycleContainerColor(itemId);
          break;
        case 'add-checklist-item':
          this.addChecklistItem(itemId);
          break;
        case 'delete-checklist-item':
          const checklistItem = e.target.closest('.checklist-item');
          if (checklistItem) {
            this.deleteChecklistItem(itemId, checklistItem.dataset.itemId);
          }
          break;
        case 'generate-checklist':
          this.openAiInputModal(itemId, 'checklist');
          break;
        case 'expand-note':
          this.openAiInputModal(itemId, 'note');
          break;
        case 'copy-image':
          this.copyImageToClipboard(itemId);
          break;
      }
    });

    // Delegated input for title and content changes
    this.canvasSurface.addEventListener('input', (e) => {
      const item = e.target.closest('.canvas-item');
      if (!item) return;

      const itemId = item.dataset.itemId;

      if (e.target.classList.contains('item-title')) {
        Store.updateItem(itemId, { title: e.target.value });
        this.pushHistoryDebounced();
      } else if (e.target.classList.contains('note-content')) {
        Store.updateItem(itemId, { content: e.target.value });
        this.pushHistoryDebounced();
      } else if (e.target.classList.contains('item-text')) {
        // Checklist item text
        const checklistItem = e.target.closest('.checklist-item');
        if (checklistItem) {
          this.updateChecklistItemText(itemId, checklistItem.dataset.itemId, e.target.value);
        }
      }
    });

    // Delegated change for checkboxes
    this.canvasSurface.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;

      const item = e.target.closest('.canvas-item');
      const checklistItem = e.target.closest('.checklist-item');
      if (!item || !checklistItem) return;

      this.toggleChecklistItem(item.dataset.itemId, checklistItem.dataset.itemId, e.target.checked);
    });

    // Delegated keydown for Enter (new item) and Tab (indentation)
    this.canvasSurface.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('item-text')) return;

      const item = e.target.closest('.canvas-item');
      const checklistItem = e.target.closest('.checklist-item');
      if (!item || !checklistItem) return;

      const itemId = item.dataset.itemId;
      const checklistItemId = checklistItem.dataset.itemId;

      if (e.key === 'Enter') {
        e.preventDefault();
        this.addChecklistItem(itemId);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.toggleChecklistItemNesting(itemId, checklistItemId, !e.shiftKey);
      }
    });
  }

  async populateWorkspaceDropdown() {
    const workspaces = await Store.getWorkspaces();
    const currentWorkspace = Store.getCurrentWorkspace();

    this.workspaceSelector.innerHTML = '';

    workspaces.forEach(ws => {
      const option = document.createElement('option');
      option.value = ws.id;
      option.textContent = ws.name;
      if (currentWorkspace && ws.id === currentWorkspace.id) {
        option.selected = true;
      }
      this.workspaceSelector.appendChild(option);
    });

    // Add "New Workspace" option
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ New Workspace';
    this.workspaceSelector.appendChild(newOption);

    // Add "Import Workspace" option
    const importOption = document.createElement('option');
    importOption.value = '__import__';
    importOption.textContent = '📥 Import Workspace...';
    this.workspaceSelector.appendChild(importOption);

    // Add "Import All Workspaces" option
    const importAllOption = document.createElement('option');
    importAllOption.value = '__import_all__';
    importAllOption.textContent = '📦 Import All Workspaces...';
    this.workspaceSelector.appendChild(importAllOption);
  }

  updateWorkspaceDropdownSelection() {
    const currentWorkspace = Store.getCurrentWorkspace();
    if (currentWorkspace) {
      this.workspaceSelector.value = currentWorkspace.id;
    }
  }

  async handleWorkspaceChange(value) {
    if (value === '__new__') {
      // Prompt for new workspace name
      const name = prompt('Enter workspace name:');
      if (name && name.trim()) {
        const workspace = await Store.createWorkspace(name.trim());
        await Store.switchWorkspace(workspace.id);
        await this.populateWorkspaceDropdown();
      } else {
        // Reset to current workspace if cancelled
        this.updateWorkspaceDropdownSelection();
      }
    } else if (value === '__import__') {
      // Trigger file picker for import
      this.importFileInput.dataset.importType = 'single';
      this.importFileInput.click();
      // Reset to current workspace (import will switch if successful)
      this.updateWorkspaceDropdownSelection();
    } else if (value === '__import_all__') {
      // Trigger file picker for import all
      this.importFileInput.dataset.importType = 'all';
      this.importFileInput.click();
      // Reset to current workspace
      this.updateWorkspaceDropdownSelection();
    } else {
      await Store.switchWorkspace(value);
    }
  }

  async renameWorkspace() {
    const currentWorkspace = Store.getCurrentWorkspace();
    if (!currentWorkspace) return;

    const newName = prompt('Enter new workspace name:', currentWorkspace.name);
    if (newName && newName.trim() && newName.trim() !== currentWorkspace.name) {
      await Store.renameWorkspace(currentWorkspace.id, newName.trim());
      await this.populateWorkspaceDropdown();
    }
  }

  async deleteWorkspace() {
    const currentWorkspace = Store.getCurrentWorkspace();
    if (!currentWorkspace) return;

    const workspaces = await Store.getWorkspaces();
    if (workspaces.length <= 1) {
      alert('Cannot delete the last workspace.');
      return;
    }

    const confirmed = confirm(`Delete workspace "${currentWorkspace.name}"?\n\nThis will permanently delete all items in this workspace.`);
    if (confirmed) {
      // Delete associated history
      await HistoryManager.deleteWorkspaceHistory(currentWorkspace.id);

      const switchToId = await Store.deleteWorkspace(currentWorkspace.id);
      if (switchToId) {
        await Store.switchWorkspace(switchToId);
        await this.populateWorkspaceDropdown();
      }
    }
  }

  async exportWorkspace() {
    const currentWorkspace = Store.getCurrentWorkspace();
    if (!currentWorkspace) return;

    const json = await Store.exportWorkspace();
    if (!json) return;

    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWorkspace.name.replace(/[^a-z0-9]/gi, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[SpawnCanvas] Workspace exported:', currentWorkspace.name);
  }

  async exportAllWorkspaces() {
    const json = await Store.exportAllWorkspaces();
    if (!json) return;

    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `SpawnCanvas_all_workspaces_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[SpawnCanvas] All workspaces exported');
  }

  async handleImportFile(file) {
    if (!file) return;

    const importType = this.importFileInput.dataset.importType || 'single';

    try {
      const text = await file.text();

      if (importType === 'all') {
        const workspaces = await Store.importAllWorkspaces(text);
        if (workspaces.length > 0) {
          // Switch to the first imported workspace
          await Store.switchWorkspace(workspaces[0].id);
          await this.populateWorkspaceDropdown();
          alert(`Successfully imported ${workspaces.length} workspace(s).`);
        }
      } else {
        const workspace = await Store.importWorkspace(text);
        if (workspace) {
          // Switch to the imported workspace
          await Store.switchWorkspace(workspace.id);
          await this.populateWorkspaceDropdown();
        }
      }
    } catch (err) {
      console.error('[SpawnCanvas] Error reading import file:', err);
      alert('Failed to read import file.');
    }
  }

  /**
   * Push current state to history stack
   */
  pushHistory() {
    const items = Store.getAllItems();
    HistoryManager.push(items);
  }

  /**
   * Debounced push for text changes
   */
  pushHistoryDebounced() {
    if (this._historyDebounceTimer) {
      clearTimeout(this._historyDebounceTimer);
    }
    this._historyDebounceTimer = setTimeout(() => {
      this.pushHistory();
      this._historyDebounceTimer = null;
    }, 1000);
  }

  /**
   * Undo last action
   */
  undo() {
    const currentItems = Store.getAllItems();
    const previousState = HistoryManager.undo(currentItems);

    if (previousState) {
      this.restoreState(previousState);
    }
  }

  /**
   * Redo last undone action
   */
  redo() {
    const currentItems = Store.getAllItems();
    const nextState = HistoryManager.redo(currentItems);

    if (nextState) {
      this.restoreState(nextState);
    }
  }

  /**
   * Restore state from history
   */
  restoreState(items) {
    HistoryManager.setRestoring(true);

    // Get current workspace and replace items
    const workspace = Store.getCurrentWorkspace();
    if (workspace) {
      workspace.items = items;
      Store.saveNow();
    }

    // Re-render canvas
    this.clearCanvas();
    this.renderAllItems();

    HistoryManager.setRestoring(false);
  }

  clearCanvas() {
    const items = this.canvasSurface.querySelectorAll('.canvas-item');
    items.forEach(item => item.remove());
    this.selectedItems.clear();
  }

  renderAllItems() {
    const items = Store.getAllItems();
    items.forEach(item => {
      if (item.type === 'note') {
        this.renderNote(item);
      } else if (item.type === 'checklist') {
        this.renderChecklist(item);
      } else if (item.type === 'container') {
        this.renderContainer(item);
      } else if (item.type === 'image') {
        this.renderImage(item);
      }
    });
  }

  handleKeyDown(e) {
    // Handle Ctrl+Z / Ctrl+Y even in inputs (but not during text composition)
    if ((e.ctrlKey || e.metaKey) && !e.isComposing) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        this.redo();
        return;
      }
    }

    // Ignore other keys if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        this.handleClose();
        break;
      case 'Home':
      case '0':
        this.resetView();
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelectedItems();
        break;
      case '1':
        this.navigateItems(-1); // Previous item
        break;
      case '2':
        this.navigateItems(1); // Next item
        break;
    }
  }

  handleToolbarAction(action) {
    switch (action) {
      case 'add-note':
        this.addNote();
        break;
      case 'add-checklist':
        this.addChecklist();
        break;
      case 'add-container':
        this.addContainer();
        break;
      case 'center':
        this.resetView();
        break;
      case 'close':
        this.handleClose();
        break;
      case 'rename-workspace':
        this.renameWorkspace();
        break;
      case 'delete-workspace':
        this.deleteWorkspace();
        break;
      case 'export-workspace':
        this.exportWorkspace();
        break;
      case 'export-all':
        this.exportAllWorkspaces();
        break;
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
      case 'toggle-settings':
        this.toggleSettingsMenu();
        break;
      case 'save-api-key':
        this.saveApiKey();
        break;
      case 'toggle-prompts':
        this.togglePromptsModal();
        break;
      case 'close-prompts':
        this.closePromptsModal();
        break;
      case 'save-prompts':
        this.savePrompts();
        break;
      case 'reset-checklist-prompt':
        this.resetChecklistPrompt();
        break;
      case 'reset-note-prompt':
        this.resetNotePrompt();
        break;
      case 'close-ai-input':
        this.closeAiInputModal();
        break;
      case 'submit-ai-input':
        this.submitAiInput();
        break;
    }
  }

  async toggleSettingsMenu() {
    const isOpening = !this.settingsDropdown.classList.contains('open');
    this.settingsDropdown.classList.toggle('open');

    // Load settings when opening
    if (isOpening) {
      const [apiKey, provider] = await Promise.all([
        Store.getApiKey(),
        Store.getAiProvider()
      ]);
      this.apiKeyInput.value = apiKey || '';
      this.aiProviderSelect.value = provider || 'claude';
    }
  }

  closeSettingsMenu() {
    this.settingsDropdown.classList.remove('open');
  }

  async saveApiKey() {
    const apiKey = this.apiKeyInput.value.trim();
    const provider = this.aiProviderSelect.value;

    await Promise.all([
      Store.setApiKey(apiKey),
      Store.setAiProvider(provider)
    ]);

    if (apiKey) {
      alert(`Settings saved!\nProvider: ${provider}\nAPI key: ${apiKey.substring(0, 10)}...`);
    } else {
      alert('API key cleared.');
    }
    this.closeSettingsMenu();
  }

  async togglePromptsModal() {
    const isOpening = !this.promptsModal.classList.contains('open');

    if (isOpening) {
      // Load current prompts when opening
      const [checklistPrompt, notePrompt] = await Promise.all([
        PromptManager.getPrompt('checklist'),
        PromptManager.getPrompt('note')
      ]);
      this.checklistPromptTextarea.value = checklistPrompt;
      this.notePromptTextarea.value = notePrompt;
    }

    this.promptsModal.classList.toggle('open');
  }

  closePromptsModal() {
    this.promptsModal.classList.remove('open');
  }

  async savePrompts() {
    const checklistPrompt = this.checklistPromptTextarea.value.trim();
    const notePrompt = this.notePromptTextarea.value.trim();

    await Promise.all([
      PromptManager.setPrompt('checklist', checklistPrompt || null),
      PromptManager.setPrompt('note', notePrompt || null)
    ]);

    alert('Prompts saved successfully!');
    this.closePromptsModal();
  }

  async resetChecklistPrompt() {
    const defaultPrompt = PromptManager.getDefault('checklist');
    this.checklistPromptTextarea.value = defaultPrompt;
    await PromptManager.resetToDefault('checklist');
  }

  async resetNotePrompt() {
    const defaultPrompt = PromptManager.getDefault('note');
    this.notePromptTextarea.value = defaultPrompt;
    await PromptManager.resetToDefault('note');
  }

  openAiInputModal(itemId, type) {
    const item = Store.getItem(itemId);
    if (!item) return;

    // Set the target
    this.aiInputTarget = { id: itemId, type };

    // Update modal title based on type
    if (type === 'checklist') {
      this.aiInputTitle.textContent = 'Generate Checklist Items';
      this.aiInputTextarea.placeholder = `E.g., Create a checklist for "${item.title || 'untitled'}"...\n\nOr describe what items you need...`;
    } else {
      this.aiInputTitle.textContent = 'Expand Note with AI';
      this.aiInputTextarea.placeholder = `E.g., Write about "${item.title || 'untitled'}"...\n\nOr describe what content you want...`;
    }

    // Pre-fill with title if no existing content
    if (item.title && item.title.trim()) {
      this.aiInputTextarea.value = item.title;
    } else {
      this.aiInputTextarea.value = '';
    }

    this.aiInputModal.classList.add('open');
    this.aiInputTextarea.focus();
    this.aiInputTextarea.select();
  }

  closeAiInputModal() {
    this.aiInputModal.classList.remove('open');
    this.aiInputTarget = null;
    this.aiInputTextarea.value = '';
  }

  // ============================================
  // TAB SWITCHING
  // ============================================

  switchTab(tab) {
    if (this.activeTab === tab) return;

    this.activeTab = tab;

    // Update tab button states
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (tab === 'workspace') {
      this.canvasArea.classList.remove('hidden');
      this.memoryArea.classList.add('hidden');
      this.workspaceControls.classList.remove('hidden');
    } else if (tab === 'memory') {
      this.canvasArea.classList.add('hidden');
      this.memoryArea.classList.remove('hidden');
      this.workspaceControls.classList.add('hidden');
      this.loadMemoryView();
    }
  }

  async loadMemoryView() {
    const memories = await Store.getMemories();
    this.renderProjectList(memories.projects);
  }

  renderProjectList(projects) {
    const projectIds = Object.keys(projects);

    if (projectIds.length === 0) {
      this.projectList.innerHTML = `
        <div class="project-list-empty">
          <p>No memories captured yet.</p>
          <p class="hint">Chat with spawn.co to auto-capture prompts and responses.</p>
        </div>
      `;
      return;
    }

    // Sort projects by updatedAt (most recent first)
    const sortedProjects = projectIds
      .map(id => projects[id])
      .sort((a, b) => b.updatedAt - a.updatedAt);

    this.projectList.innerHTML = sortedProjects.map(project => {
      const messageCount = project.messages.length;
      const lastUpdated = this.formatDate(project.updatedAt);
      const isSelected = this.selectedProjectId === project.id;

      return `
        <div class="project-item ${isSelected ? 'selected' : ''}" data-project-id="${project.id}">
          <div class="project-name">${this.escapeHtml(project.id)}</div>
          <div class="project-meta">
            <span>${messageCount} message${messageCount !== 1 ? 's' : ''}</span>
            <span>${lastUpdated}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  async selectProject(projectId) {
    this.selectedProjectId = projectId;

    // Update selected state in list
    const projectItems = this.projectList.querySelectorAll('.project-item');
    projectItems.forEach(item => {
      item.classList.toggle('selected', item.dataset.projectId === projectId);
    });

    // Update header
    this.memoryProjectTitle.textContent = projectId;
    this.deleteProjectBtn.classList.remove('hidden');

    // Load and render chat history
    const project = await Store.getProjectMemory(projectId);
    this.renderChatHistory(project);
  }

  renderChatHistory(project) {
    if (!project || !project.messages || project.messages.length === 0) {
      this.chatHistory.innerHTML = `
        <div class="chat-empty-state">
          <p>No messages in this project yet.</p>
        </div>
      `;
      return;
    }

    this.chatHistory.innerHTML = project.messages.map(msg => {
      const promptTime = msg.promptTimestamp ? this.formatTime(msg.promptTimestamp) : '';
      const responseTime = msg.responseTimestamp ? this.formatTime(msg.responseTimestamp) : '';

      return `
        <div class="memory-message" data-message-id="${msg.id}">
          <div class="message-prompt">
            <div class="message-header">
              <span class="message-role">You</span>
              <span class="message-time">${promptTime}</span>
              <button class="message-delete-btn" data-action="delete-message" data-message-id="${msg.id}" title="Delete message">×</button>
            </div>
            <div class="message-content">${this.escapeHtml(msg.prompt)}</div>
          </div>
          ${msg.response ? `
            <div class="message-response">
              <div class="message-header">
                <span class="message-role">AI</span>
                <span class="message-time">${responseTime}</span>
              </div>
              <div class="message-content">${this.escapeHtml(msg.response)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom (latest message)
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  async deleteSelectedProject() {
    if (!this.selectedProjectId) return;

    const confirmed = confirm(`Delete all memories for "${this.selectedProjectId}"?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    await Store.deleteProjectMemory(this.selectedProjectId);

    // Reset selection and reload
    this.selectedProjectId = null;
    this.memoryProjectTitle.textContent = 'Select a project';
    this.deleteProjectBtn.classList.add('hidden');
    this.chatHistory.innerHTML = `
      <div class="chat-empty-state">
        <p>Select a project from the left panel to view its chat history.</p>
      </div>
    `;

    await this.loadMemoryView();
  }

  async deleteMessage(projectId, messageId) {
    const confirmed = confirm('Delete this message?');
    if (!confirmed) return;

    await Store.deleteMemoryMessage(projectId, messageId);

    // Reload chat history
    const project = await Store.getProjectMemory(projectId);
    this.renderChatHistory(project);

    // Reload project list to update message count
    await this.loadMemoryView();
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async submitAiInput() {
    if (!this.aiInputTarget) return;

    const userPrompt = this.aiInputTextarea.value.trim();
    if (!userPrompt) {
      alert('Please enter a prompt.');
      return;
    }

    const { id, type } = this.aiInputTarget;
    this.closeAiInputModal();

    if (type === 'checklist') {
      await this.generateChecklistItems(id, userPrompt);
    } else {
      await this.expandNoteContent(id, userPrompt);
    }
  }

  handleCanvasMouseDown(e) {
    // Only act if clicking on canvas background
    const isCanvasBackground = e.target === this.canvasArea ||
      e.target === this.canvasSurface ||
      e.target.classList.contains('center-anchor');

    if (!isCanvasBackground) return;

    // Space+Drag = Pan
    if (this.isSpaceDown) {
      this.isPanning = true;
      this.panStart = {
        x: e.clientX - this.panOffset.x,
        y: e.clientY - this.panOffset.y
      };
      this.canvasArea.classList.add('panning');
    } else {
      // Regular drag on empty space = Selection box
      this.startSelection(e);
    }
  }

  startSelection(e) {
    this.isSelecting = true;

    // Get mouse position relative to canvas surface
    const surfaceRect = this.canvasSurface.getBoundingClientRect();
    this.selectionStart = {
      x: e.clientX - surfaceRect.left,
      y: e.clientY - surfaceRect.top
    };

    // Create selection box element
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'selection-box';
    this.selectionBox.style.left = `${this.selectionStart.x}px`;
    this.selectionBox.style.top = `${this.selectionStart.y}px`;
    this.selectionBox.style.width = '0px';
    this.selectionBox.style.height = '0px';
    this.canvasSurface.appendChild(this.selectionBox);

    this.canvasArea.classList.add('selecting');
  }

  handleCanvasMouseMove(e) {
    if (this.isPanning) {
      this.panOffset = {
        x: e.clientX - this.panStart.x,
        y: e.clientY - this.panStart.y
      };
      this.updateCanvasTransform();
    } else if (this.isSelecting) {
      this.updateSelection(e);
    }
  }

  updateSelection(e) {
    if (!this.selectionBox) return;

    const surfaceRect = this.canvasSurface.getBoundingClientRect();
    const currentX = e.clientX - surfaceRect.left;
    const currentY = e.clientY - surfaceRect.top;

    // Calculate box dimensions (handle negative drag)
    const left = Math.min(this.selectionStart.x, currentX);
    const top = Math.min(this.selectionStart.y, currentY);
    const width = Math.abs(currentX - this.selectionStart.x);
    const height = Math.abs(currentY - this.selectionStart.y);

    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;

    // Live selection feedback - highlight items that intersect
    this.updateSelectionHighlight({ left, top, width, height });
  }

  updateSelectionHighlight(boxRect) {
    const items = Store.getAllItems();
    const shiftHeld = false; // We'll check this on mouse up for final selection

    items.forEach(item => {
      const element = this.canvasSurface.querySelector(`[data-item-id="${item.id}"]`);
      if (!element) return;

      const itemRect = {
        left: item.position.x,
        top: item.position.y,
        width: item.size.width,
        height: item.size.height
      };

      if (this.checkIntersection(boxRect, itemRect)) {
        element.classList.add('selection-highlight');
      } else {
        element.classList.remove('selection-highlight');
      }
    });
  }

  checkIntersection(boxA, boxB) {
    // "Touch" intersection - any overlap counts
    return !(
      boxA.left > boxB.left + boxB.width ||
      boxA.left + boxA.width < boxB.left ||
      boxA.top > boxB.top + boxB.height ||
      boxA.top + boxA.height < boxB.top
    );
  }

  handleCanvasMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvasArea.classList.remove('panning');

      // Save viewport position
      Store.updateViewport(this.panOffset.x, this.panOffset.y);
    } else if (this.isSelecting) {
      this.endSelection(e);
    }
  }

  endSelection(e) {
    if (!this.selectionBox) {
      this.isSelecting = false;
      return;
    }

    // Get final selection box dimensions
    const boxRect = {
      left: parseFloat(this.selectionBox.style.left),
      top: parseFloat(this.selectionBox.style.top),
      width: parseFloat(this.selectionBox.style.width),
      height: parseFloat(this.selectionBox.style.height)
    };

    // Remove selection box element
    this.selectionBox.remove();
    this.selectionBox = null;
    this.isSelecting = false;
    this.canvasArea.classList.remove('selecting');

    // Clear highlight classes
    const highlighted = this.canvasSurface.querySelectorAll('.selection-highlight');
    highlighted.forEach(el => el.classList.remove('selection-highlight'));

    // If box is too small (just a click), treat as deselect
    if (boxRect.width < 5 && boxRect.height < 5) {
      if (!e.shiftKey) {
        this.deselectAll();
      }
      return;
    }

    // Find all items that intersect with the selection box
    const items = Store.getAllItems();
    const selectedIds = [];

    items.forEach(item => {
      const itemRect = {
        left: item.position.x,
        top: item.position.y,
        width: item.size.width,
        height: item.size.height
      };

      if (this.checkIntersection(boxRect, itemRect)) {
        selectedIds.push(item.id);
      }
    });

    // Apply selection
    if (e.shiftKey) {
      // Add to existing selection
      selectedIds.forEach(id => {
        this.selectedItems.add(id);
        const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
        if (element) {
          element.classList.add('selected');
          this.bringToFront(element);
        }
      });
    } else {
      // Replace selection
      this.deselectAll();
      selectedIds.forEach(id => {
        this.selectedItems.add(id);
        const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
        if (element) {
          element.classList.add('selected');
          this.bringToFront(element);
        }
      });
    }
  }


  /**
   * Auto-resize checklist to fit content
   */
  autoResizeChecklist(id) {
    const checklistElement = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
    if (!checklistElement) return;

    const checklistContent = checklistElement.querySelector('.item-content');
    if (!checklistContent) return;

    // Get current height and scroll height
    const currentHeight = parseFloat(checklistElement.style.height);
    const headerHeight = 37; // Approx header height
    const padding = 24; // Top+bottom padding
    const contentHeight = checklistContent.scrollHeight;

    // Calculate required height based on content
    const minHeight = 100; // Minimum height
    const requiredHeight = contentHeight + headerHeight + 5; // +5 buffer

    // Resize if content is larger than current container
    if (requiredHeight > currentHeight) {
      const newHeight = Math.max(requiredHeight, minHeight);
      checklistElement.style.height = `${newHeight}px`;

      // Update store
      const item = Store.getItem(id);
      if (item) {
        item.size.height = newHeight;
        Store.updateItem(id, { size: item.size });
      }
    }
  }

  bringToFront(element) {
    // Re-append to parent to bring to front (DOM order = z-index for same z-index value)
    if (element && element.parentNode) {
      element.parentNode.appendChild(element);
    }
  }

  updateCanvasTransform() {
    this.canvasSurface.style.transform =
      `translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
  }

  resetView() {
    const areaRect = this.canvasArea.getBoundingClientRect();
    const centerX = this.canvasSize / 2;
    const centerY = this.canvasSize / 2;

    this.panOffset = {
      x: -(centerX - areaRect.width / 2),
      y: -(centerY - areaRect.height / 2)
    };

    this.updateCanvasTransform();

    // Save viewport position
    Store.updateViewport(this.panOffset.x, this.panOffset.y);
  }

  handleClose() {
    // Save before closing
    Store.saveNow();

    // Dispatch event to overlay manager
    const event = new CustomEvent('spawn-canvas-close', { bubbles: true, composed: true });
    this.wrapper.dispatchEvent(event);
  }

  deselectAll() {
    this.selectedItems.forEach(id => {
      const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
      if (element) {
        element.classList.remove('selected');
      }
    });
    this.selectedItems.clear();
  }

  deleteSelectedItems() {
    if (this.selectedItems.size === 0) return;

    this.selectedItems.forEach(id => {
      this.deleteItem(id);
    });
    this.selectedItems.clear();
  }

  navigateItems(direction) {
    const items = Store.getAllItems();
    if (items.length === 0) return;

    const itemIds = items.map(item => item.id);

    let currentIndex = -1;
    if (this.selectedItems.size === 1) {
      const selectedId = Array.from(this.selectedItems)[0];
      currentIndex = itemIds.indexOf(selectedId);
    }

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = itemIds.length - 1;
    if (nextIndex >= itemIds.length) nextIndex = 0;

    this.deselectAll();
    this.selectItem(itemIds[nextIndex]);
    this.panToItem(itemIds[nextIndex]);
  }

  selectItem(id, addToSelection = false) {
    if (!addToSelection) {
      this.deselectAll();
    }

    // If Shift+Click on already selected item, toggle it off
    if (addToSelection && this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
      const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
      if (element) {
        element.classList.remove('selected');
      }
      return;
    }

    this.selectedItems.add(id);
    const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
    if (element) {
      element.classList.add('selected');
      this.bringToFront(element);
    }
  }

  panToItem(id) {
    const item = Store.getItem(id);
    if (!item) return;

    const areaRect = this.canvasArea.getBoundingClientRect();

    // Center the item in the viewport
    this.panOffset = {
      x: -(item.position.x + item.size.width / 2 - areaRect.width / 2),
      y: -(item.position.y + item.size.height / 2 - areaRect.height / 2)
    };

    this.updateCanvasTransform();
    Store.updateViewport(this.panOffset.x, this.panOffset.y);
  }

  getNewItemPosition() {
    const areaRect = this.canvasArea.getBoundingClientRect();
    const viewCenterX = -this.panOffset.x + areaRect.width / 2;
    const viewCenterY = -this.panOffset.y + areaRect.height / 2;

    // Snap to grid
    const x = Math.round((viewCenterX - 100) / this.gridSize) * this.gridSize;
    const y = Math.round((viewCenterY - 75) / this.gridSize) * this.gridSize;

    return { x, y };
  }

  addNote() {
    // Save state before adding
    this.pushHistory();

    const position = this.getNewItemPosition();

    const note = Store.createItem('note', {
      title: '',
      content: '',
      position,
      size: { width: 250, height: 180 }
    });

    if (note) {
      this.renderNote(note);
      this.selectItem(note.id);

      // Focus the title input
      setTimeout(() => {
        const titleInput = this.canvasSurface.querySelector(`[data-item-id="${note.id}"] .item-title`);
        if (titleInput) titleInput.focus();
      }, 0);
    }
  }

  /**
   * Create a note from pasted content (when nothing is focused)
   */
  createNoteFromPaste(content) {
    // Save state before adding
    this.pushHistory();

    const position = this.getNewItemPosition();

    // Calculate height based on content length (rough estimate)
    const lineCount = content.split('\n').length;
    const estimatedHeight = Math.max(180, Math.min(400, 80 + lineCount * 20));

    const note = Store.createItem('note', {
      title: 'Copied content',
      content: content,
      position,
      size: { width: 300, height: estimatedHeight }
    });

    if (note) {
      this.renderNote(note);
      this.selectItem(note.id);
    }
  }

  /**
   * Create an image item from pasted image (when nothing is focused)
   */
  createImageFromPaste(blob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        // Scale down if too large (max 800px width/height)
        let width = img.width;
        let height = img.height;
        const maxSize = 800;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Ensure minimum size
        width = Math.max(100, width);
        height = Math.max(100, height);

        this.pushHistory();
        const position = this.getNewItemPosition();

        const imageItem = Store.createItem('image', {
          imageData: base64Data,
          position,
          size: { width, height }
        });

        if (imageItem) {
          this.renderImage(imageItem);
          this.selectItem(imageItem.id);
        }
      };
      img.src = base64Data;
    };
    reader.readAsDataURL(blob);
  }

  renderNote(note) {
    const element = document.createElement('div');
    element.className = 'canvas-item note';
    element.dataset.itemId = note.id;
    element.style.left = `${note.position.x}px`;
    element.style.top = `${note.position.y}px`;
    element.style.width = `${note.size.width}px`;
    element.style.height = `${note.size.height}px`;

    element.innerHTML = `
      <div class="item-header">
        <input type="text" class="item-title" placeholder="Note title..." value="${this.escapeHtml(note.title)}">
        <div class="item-actions">
          <button class="generate-btn" data-action="expand-note" title="Expand with AI">✨</button>
          <button class="copy-btn" data-action="copy" title="Copy to clipboard">📋</button>
          <button class="delete-btn" data-action="delete" title="Delete">🗑</button>
        </div>
      </div>
      <div class="item-content">
        <textarea class="note-content" placeholder="Write your note...">${this.escapeHtml(note.content)}</textarea>
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.canvasSurface.appendChild(element);
  }

  renderImage(image) {
    const element = document.createElement('div');
    element.className = 'canvas-item image';
    element.dataset.itemId = image.id;
    element.style.left = `${image.position.x}px`;
    element.style.top = `${image.position.y}px`;
    element.style.width = `${image.size.width}px`;
    element.style.height = `${image.size.height}px`;

    element.innerHTML = `
      <div class="image-content">
        <img src="${image.imageData}" alt="Pasted image" draggable="false">
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.canvasSurface.appendChild(element);
  }

  addChecklist() {
    // Save state before adding
    this.pushHistory();

    const position = this.getNewItemPosition();

    const checklist = Store.createItem('checklist', {
      title: '',
      items: [],
      position,
      size: { width: 280, height: 200 }
    });

    if (checklist) {
      this.renderChecklist(checklist);
      this.selectItem(checklist.id);

      // Focus the title input
      setTimeout(() => {
        const titleInput = this.canvasSurface.querySelector(`[data-item-id="${checklist.id}"] .item-title`);
        if (titleInput) titleInput.focus();
      }, 0);
    }
  }

  renderChecklist(checklist) {
    const element = document.createElement('div');
    element.className = 'canvas-item checklist';
    element.dataset.itemId = checklist.id;
    element.style.left = `${checklist.position.x}px`;
    element.style.top = `${checklist.position.y}px`;
    element.style.width = `${checklist.size.width}px`;
    element.style.height = `${checklist.size.height}px`;

    element.innerHTML = `
      <div class="item-header">
        <input type="text" class="item-title" placeholder="Checklist title..." value="${this.escapeHtml(checklist.title)}">
        <div class="item-actions">
          <button class="generate-btn" data-action="generate-checklist" title="Generate items with AI">✨</button>
          <button class="copy-btn" data-action="copy" title="Copy to clipboard">📋</button>
          <button class="delete-btn" data-action="delete" title="Delete">🗑</button>
        </div>
      </div>
      <div class="item-content">
        <ul class="checklist-items">
          ${this.renderChecklistItems(checklist.items)}
        </ul>
        <div class="add-checklist-item" data-action="add-checklist-item">+ Add item</div>
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.canvasSurface.appendChild(element);
  }

  renderChecklistItems(items) {
    if (!items || items.length === 0) return '';

    return items.map(item => `
      <li class="checklist-item ${item.completed ? 'completed' : ''} ${item.nested ? `nested-${item.nested}` : ''}" data-item-id="${item.id}">
        <input type="checkbox" ${item.completed ? 'checked' : ''}>
        <input type="text" class="item-text" value="${this.escapeHtml(item.text)}" placeholder="Item...">
        <button class="item-delete" data-action="delete-checklist-item" title="Delete item">×</button>
      </li>
    `).join('');
  }

  addChecklistItem(checklistId) {
    // Save state before adding checklist item
    this.pushHistory();

    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const newItem = {
      id: `ci_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: '',
      completed: false,
      nested: 0
    };

    checklist.items.push(newItem);
    Store.updateItem(checklistId, { items: checklist.items });

    // Re-render checklist items
    const element = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"]`);
    const ul = element.querySelector('.checklist-items');
    ul.innerHTML = this.renderChecklistItems(checklist.items);

    // Auto-resize
    setTimeout(() => {
      this.autoResizeChecklist(checklistId);

      // Focus the new item
      const inputs = ul.querySelectorAll('.item-text');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }, 0);
  }

  async generateChecklistItems(checklistId, userPrompt) {
    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const [apiKey, provider] = await Promise.all([
      Store.getApiKey(),
      Store.getAiProvider()
    ]);

    if (!apiKey) {
      alert('Please set your API key in Settings (gear icon) first.');
      return;
    }

    // Show loading state
    const element = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"]`);
    const generateBtn = element.querySelector('.generate-btn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = '⏳';
    generateBtn.disabled = true;

    try {
      const result = await AIService.generateChecklistItems(userPrompt, apiKey, provider);

      // Save state before adding items
      this.pushHistory();

      // Update title if empty and AI generated one
      if (result.title && (!checklist.title || checklist.title.trim() === '')) {
        checklist.title = result.title;
        const titleInput = element.querySelector('.item-title');
        if (titleInput) {
          titleInput.value = result.title;
        }
      }

      // Add generated items
      for (const text of result.items) {
        const newItem = {
          id: `ci_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          text: text,
          completed: false,
          nested: 0
        };
        checklist.items.push(newItem);
      }

      Store.updateItem(checklistId, { title: checklist.title, items: checklist.items });

      // Re-render checklist items
      const ul = element.querySelector('.checklist-items');
      ul.innerHTML = this.renderChecklistItems(checklist.items);

      // Auto-resize
      setTimeout(() => this.autoResizeChecklist(checklistId), 0);

    } catch (err) {
      console.error('[SpawnCanvas] AI generation error:', err);
      alert('AI generation failed: ' + err.message);
    } finally {
      generateBtn.textContent = originalText;
      generateBtn.disabled = false;
    }
  }

  async expandNoteContent(noteId, userPrompt) {
    const note = Store.getItem(noteId);
    if (!note) return;

    const [apiKey, provider] = await Promise.all([
      Store.getApiKey(),
      Store.getAiProvider()
    ]);

    if (!apiKey) {
      alert('Please set your API key in Settings (gear icon) first.');
      return;
    }

    // Show loading state
    const element = this.canvasSurface.querySelector(`[data-item-id="${noteId}"]`);
    const expandBtn = element.querySelector('[data-action="expand-note"]');
    const originalText = expandBtn.textContent;
    expandBtn.textContent = '⏳';
    expandBtn.disabled = true;

    try {
      const result = await AIService.expandNote(userPrompt, note.content, apiKey, provider);

      // Save state before updating
      this.pushHistory();

      // Update title if empty and AI generated one
      if (result.title && (!note.title || note.title.trim() === '')) {
        note.title = result.title;
        const titleInput = element.querySelector('.item-title');
        if (titleInput) {
          titleInput.value = result.title;
        }
      }

      // Update note content
      Store.updateItem(noteId, { title: note.title, content: result.content });

      // Update textarea
      const textarea = element.querySelector('.note-content');
      if (textarea) {
        textarea.value = result.content;
      }

    } catch (err) {
      console.error('[SpawnCanvas] AI expansion error:', err);
      alert('AI expansion failed: ' + err.message);
    } finally {
      expandBtn.textContent = originalText;
      expandBtn.disabled = false;
    }
  }

  toggleChecklistItem(checklistId, itemId, completed) {
    // Save state before toggling
    this.pushHistory();

    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      item.completed = completed;
      Store.updateItem(checklistId, { items: checklist.items });

      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) {
        li.classList.toggle('completed', completed);
      }
    }
  }

  updateChecklistItemText(checklistId, itemId, text) {
    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      item.text = text;
      Store.updateItem(checklistId, { items: checklist.items });
      this.pushHistoryDebounced();
    }
  }

  deleteChecklistItem(checklistId, itemId) {
    // Save state before deleting checklist item
    this.pushHistory();

    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const index = checklist.items.findIndex(i => i.id === itemId);
    if (index > -1) {
      checklist.items.splice(index, 1);
      Store.updateItem(checklistId, { items: checklist.items });

      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) {
        li.remove();
        // Auto-resize
        this.autoResizeChecklist(checklistId);
      }
    }
  }


  toggleChecklistItemNesting(checklistId, itemId, indent) {
    // Save state before changing nesting
    this.pushHistory();

    const checklist = Store.getItem(checklistId);
    if (!checklist) return;

    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      if (indent && item.nested < 2) {
        item.nested = (item.nested || 0) + 1;
      } else if (!indent && item.nested > 0) {
        item.nested = item.nested - 1;
      }
      Store.updateItem(checklistId, { items: checklist.items });

      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) {
        li.classList.remove('nested-1', 'nested-2');
        if (item.nested > 0) {
          li.classList.add(`nested-${item.nested}`);
        }
      }
    }
  }

  addContainer() {
    // Save state before adding
    this.pushHistory();

    const position = this.getNewItemPosition();

    const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const container = Store.createItem('container', {
      title: '',
      color: randomColor,
      position,
      size: { width: 350, height: 250 },
      children: []
    });

    if (container) {
      this.renderContainer(container);
      this.selectItem(container.id);

      // Focus the title input
      setTimeout(() => {
        const titleInput = this.canvasSurface.querySelector(`[data-item-id="${container.id}"] .item-title`);
        if (titleInput) titleInput.focus();
      }, 0);
    }
  }

  renderContainer(container) {
    const element = document.createElement('div');
    element.className = `canvas-item container color-${container.color}`;
    element.dataset.itemId = container.id;
    element.style.left = `${container.position.x}px`;
    element.style.top = `${container.position.y}px`;
    element.style.width = `${container.size.width}px`;
    element.style.height = `${container.size.height}px`;

    element.innerHTML = `
      <div class="container-color-bar"></div>
      <div class="item-header">
        <input type="text" class="item-title" placeholder="Container title..." value="${this.escapeHtml(container.title)}">
        <div class="item-actions">
          <button class="color-btn" data-action="cycle-color" title="Change color">🎨</button>
          <button class="delete-btn" data-action="delete" title="Delete">🗑</button>
        </div>
      </div>
      <div class="container-content">
        <!-- Contained items would be rendered here -->
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.canvasSurface.appendChild(element);
  }

  cycleContainerColor(containerId) {
    // Save state before changing color
    this.pushHistory();

    const container = Store.getItem(containerId);
    if (!container) return;

    const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
    const currentIndex = colors.indexOf(container.color);
    const nextIndex = (currentIndex + 1) % colors.length;

    const newColor = colors[nextIndex];
    Store.updateItem(containerId, { color: newColor });

    const element = this.canvasSurface.querySelector(`[data-item-id="${containerId}"]`);
    if (element) {
      colors.forEach(c => element.classList.remove(`color-${c}`));
      element.classList.add(`color-${newColor}`);
    }
  }

  /**
   * Get all items whose center point is inside a container
   */
  getItemsInsideContainer(containerId) {
    const container = Store.getItem(containerId);
    if (!container || container.type !== 'container') return [];

    const containerBounds = {
      left: container.position.x,
      right: container.position.x + container.size.width,
      top: container.position.y,
      bottom: container.position.y + container.size.height
    };

    return Store.getAllItems().filter(item => {
      if (item.id === containerId || item.type === 'container') return false;
      // Check if item center is inside container
      const centerX = item.position.x + item.size.width / 2;
      const centerY = item.position.y + item.size.height / 2;
      return centerX >= containerBounds.left && centerX <= containerBounds.right &&
        centerY >= containerBounds.top && centerY <= containerBounds.bottom;
    });
  }

  startDrag(e, element, itemId) {
    const item = Store.getItem(itemId);
    if (!item) return;

    // Save state before drag starts
    this.pushHistory();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...item.position };

    // If dragging a container, find items inside and their relative offsets
    let groupedItems = [];
    if (item.type === 'container') {
      const insideItems = this.getItemsInsideContainer(itemId);
      groupedItems = insideItems.map(insideItem => ({
        id: insideItem.id,
        element: this.canvasSurface.querySelector(`[data-item-id="${insideItem.id}"]`),
        offsetX: insideItem.position.x - item.position.x,
        offsetY: insideItem.position.y - item.position.y,
        size: insideItem.size
      }));
    }

    element.classList.add('dragging');

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Snap to grid
      const newX = Math.round((startPos.x + deltaX) / this.gridSize) * this.gridSize;
      const newY = Math.round((startPos.y + deltaY) / this.gridSize) * this.gridSize;

      const position = {
        x: Math.max(0, Math.min(newX, this.canvasSize - item.size.width)),
        y: Math.max(0, Math.min(newY, this.canvasSize - item.size.height))
      };

      // Update container DOM
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
      element._pendingPosition = position;

      // Move grouped items along with container
      groupedItems.forEach(grouped => {
        if (grouped.element) {
          const groupedPos = {
            x: Math.max(0, Math.min(position.x + grouped.offsetX, this.canvasSize - grouped.size.width)),
            y: Math.max(0, Math.min(position.y + grouped.offsetY, this.canvasSize - grouped.size.height))
          };
          grouped.element.style.left = `${groupedPos.x}px`;
          grouped.element.style.top = `${groupedPos.y}px`;
          grouped.element._pendingPosition = groupedPos;
        }
      });
    };

    const onMouseUp = () => {
      element.classList.remove('dragging');

      // Save final position to store
      if (element._pendingPosition) {
        Store.updateItem(itemId, { position: element._pendingPosition });
        delete element._pendingPosition;
      }

      // Save grouped items' positions
      groupedItems.forEach(grouped => {
        if (grouped.element && grouped.element._pendingPosition) {
          Store.updateItem(grouped.id, { position: grouped.element._pendingPosition });
          delete grouped.element._pendingPosition;
        }
      });

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  startResize(e, element, itemId, handle) {
    const item = Store.getItem(itemId);
    if (!item) return;

    // Save state before resize starts
    this.pushHistory();

    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = { ...item.size };

    const isRight = handle.classList.contains('e') || handle.classList.contains('se');
    const isBottom = handle.classList.contains('s') || handle.classList.contains('se');

    let minWidth = 200;
    let minHeight = 100;
    if (item.type === 'container') {
      minWidth = 300;
      minHeight = 200;
    } else if (item.type === 'image') {
      minWidth = 50;
      minHeight = 50;
    }

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const size = { ...item.size };

      if (isRight) {
        const newWidth = Math.max(minWidth, startSize.width + deltaX);
        size.width = Math.round(newWidth / this.gridSize) * this.gridSize;
        element.style.width = `${size.width}px`;
      }

      if (isBottom) {
        const newHeight = Math.max(minHeight, startSize.height + deltaY);
        size.height = Math.round(newHeight / this.gridSize) * this.gridSize;
        element.style.height = `${size.height}px`;
      }

      // Store size for save on mouse up
      element._pendingSize = size;
    };

    const onMouseUp = () => {
      // Save final size to store
      if (element._pendingSize) {
        Store.updateItem(itemId, { size: element._pendingSize });
        delete element._pendingSize;
      }

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  deleteItem(id) {
    // Save state before deleting
    this.pushHistory();

    const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
    if (element) {
      element.remove();
    }
    Store.deleteItem(id);
    this.selectedItems.delete(id);
  }

  async copyItemToClipboard(id) {
    const item = Store.getItem(id);
    if (!item) return;

    let text = '';

    if (item.type === 'note') {
      text = `${item.title}\n\n${item.content}`;
    } else if (item.type === 'checklist') {
      text = `${item.title}\n\n`;
      item.items.forEach(ci => {
        const indent = '  '.repeat(ci.nested || 0);
        const checkbox = ci.completed ? '[x]' : '[ ]';
        text += `${indent}${checkbox} ${ci.text}\n`;
      });
    }

    try {
      await navigator.clipboard.writeText(text.trim());
      console.log('[SpawnCanvas] Copied to clipboard');
    } catch (err) {
      console.error('[SpawnCanvas] Failed to copy:', err);
    }
  }

  async copyImageToClipboard(id) {
    const item = Store.getItem(id);
    if (!item || !item.imageData) return;

    try {
      // Convert base64 data URL to blob
      const response = await fetch(item.imageData);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      console.log('[SpawnCanvas] Image copied to clipboard');
    } catch (err) {
      console.error('[SpawnCanvas] Failed to copy image:', err);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.CanvasApp = CanvasApp;
