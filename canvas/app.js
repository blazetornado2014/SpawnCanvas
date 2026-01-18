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
          <select class="workspace-selector">
            <option value="default">Default Workspace</option>
          </select>
          <button class="workspace-btn icon-btn" data-action="rename-workspace" title="Rename Workspace">✏️</button>
          <button class="workspace-btn icon-btn" data-action="delete-workspace" title="Delete Workspace">🗑️</button>
          <button class="add-btn" data-action="add-note">+ Note</button>
          <button class="add-btn" data-action="add-checklist">+ Checklist</button>
          <button class="add-btn" data-action="add-container">+ Container</button>
        </div>
        <div class="toolbar-right">
          <button class="undo-btn icon-btn" data-action="undo" title="Undo (Ctrl+Z)">↩️</button>
          <button class="redo-btn icon-btn" data-action="redo" title="Redo (Ctrl+Y)">↪️</button>
          <button class="center-btn icon-btn" data-action="center" title="Reset View (Home)">
            <span>⌂</span>
          </button>
          <button class="close-btn icon-btn" data-action="close" title="Close (Esc)">×</button>
        </div>
      </div>
      <div class="canvas-area">
        <div class="canvas-surface">
          <div class="center-anchor"></div>
          <!-- Canvas items will be rendered here -->
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

    // Track Space key for pan mode
    this._spaceKeyDownHandler = (e) => {
      if (!this.wrapper.isConnected) return;
      if (e.code === 'Space' && !e.target.matches('input, textarea')) {
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

    // Toolbar button clicks (delegated)
    this.toolbar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        this.handleToolbarAction(action);
      }
    });

    // Workspace selector
    this.workspaceSelector.addEventListener('change', (e) => {
      this.handleWorkspaceChange(e.target.value);
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
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
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
          <button class="copy-btn" title="Copy to clipboard">📋</button>
          <button class="delete-btn" title="Delete">🗑</button>
        </div>
      </div>
      <div class="item-content">
        <textarea class="note-content" placeholder="Write your note...">${this.escapeHtml(note.content)}</textarea>
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.attachItemListeners(element, note.id);
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
          <button class="copy-btn" title="Copy to clipboard">📋</button>
          <button class="delete-btn" title="Delete">🗑</button>
        </div>
      </div>
      <div class="item-content">
        <ul class="checklist-items">
          ${this.renderChecklistItems(checklist.items)}
        </ul>
        <div class="add-checklist-item" data-action="add-item">+ Add item</div>
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.attachItemListeners(element, checklist.id);
    this.attachChecklistListeners(element, checklist.id);
    this.canvasSurface.appendChild(element);
  }

  renderChecklistItems(items) {
    if (!items || items.length === 0) return '';

    return items.map(item => `
      <li class="checklist-item ${item.completed ? 'completed' : ''} ${item.nested ? `nested-${item.nested}` : ''}" data-item-id="${item.id}">
        <input type="checkbox" ${item.completed ? 'checked' : ''}>
        <input type="text" class="item-text" value="${this.escapeHtml(item.text)}" placeholder="Item...">
        <button class="item-delete" title="Delete item">×</button>
      </li>
    `).join('');
  }

  attachChecklistListeners(element, checklistId) {
    const content = element.querySelector('.item-content');

    // Add item button
    content.querySelector('.add-checklist-item').addEventListener('click', () => {
      this.addChecklistItem(checklistId);
    });

    // Delegate events for checklist items
    content.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.toggleChecklistItem(checklistId, itemId, e.target.checked);
      }
    });

    content.addEventListener('input', (e) => {
      if (e.target.classList.contains('item-text')) {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.updateChecklistItemText(checklistId, itemId, e.target.value);
      }
    });

    content.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-delete')) {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.deleteChecklistItem(checklistId, itemId);
      }
    });

    // Handle Enter key to add new item
    content.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('item-text')) {
        e.preventDefault();
        this.addChecklistItem(checklistId);
      }
      // Tab for indentation
      if (e.key === 'Tab' && e.target.classList.contains('item-text')) {
        e.preventDefault();
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.toggleChecklistItemNesting(checklistId, itemId, !e.shiftKey);
      }
    });
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
          <button class="color-btn" title="Change color">🎨</button>
          <button class="delete-btn" title="Delete">🗑</button>
        </div>
      </div>
      <div class="container-content">
        <!-- Contained items would be rendered here -->
      </div>
      <div class="resize-handle corner se"></div>
      <div class="resize-handle edge e"></div>
      <div class="resize-handle edge s"></div>
    `;

    this.attachItemListeners(element, container.id);
    this.attachContainerListeners(element, container.id);
    this.canvasSurface.appendChild(element);
  }

  attachContainerListeners(element, containerId) {
    const colorBtn = element.querySelector('.color-btn');

    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleContainerColor(containerId);
    });
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

  attachItemListeners(element, itemId) {
    element.addEventListener('mousedown', (e) => {
      // Don't select if clicking on input/textarea or buttons
      if (e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('resize-handle')) {
        return;
      }

      const isShiftClick = e.shiftKey;
      if (!this.selectedItems.has(itemId)) {
        this.selectItem(itemId, isShiftClick);
      }

      this.startDrag(e, element, itemId);
    });

    const titleInput = element.querySelector('.item-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        Store.updateItem(itemId, { title: e.target.value });
        this.pushHistoryDebounced();
      });

      titleInput.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag start
      });
    }

    const noteContent = element.querySelector('.note-content');
    if (noteContent) {
      noteContent.addEventListener('input', (e) => {
        Store.updateItem(itemId, { content: e.target.value });
        this.pushHistoryDebounced();
      });

      noteContent.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    }

    const deleteBtn = element.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(itemId);
      });
    }

    const copyBtn = element.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyItemToClipboard(itemId);
      });
    }

    const resizeHandles = element.querySelectorAll('.resize-handle');
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.startResize(e, element, itemId, handle);
      });
    });
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

    const minWidth = item.type === 'container' ? 300 : 200;
    const minHeight = item.type === 'container' ? 200 : 100;

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

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.CanvasApp = CanvasApp;
