/**
 * SpawnCanvas - Main Application Entry Point
 * Initializes the canvas application within the Shadow DOM
 */

/**
 * CanvasApp Class
 * Main application controller
 */
class CanvasApp {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.wrapper = null;
    this.canvasArea = null;
    this.canvasSurface = null;
    
    // Pan state
    this.panOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    
    // Selection state
    this.selectedItems = new Set();
    
    // Canvas dimensions
    this.canvasSize = 5000;
    this.gridSize = 20;
    
    // Items on canvas (will be managed by store later)
    this.items = new Map();
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleCanvasMouseDown = this.handleCanvasMouseDown.bind(this);
    this.handleCanvasMouseMove = this.handleCanvasMouseMove.bind(this);
    this.handleCanvasMouseUp = this.handleCanvasMouseUp.bind(this);
  }

  /**
   * Initialize the application
   */
  init() {
    this.render();
    this.cacheElements();
    this.attachEventListeners();
    this.resetView();
    
    console.log('[SpawnCanvas] App initialized');
  }

  /**
   * Render the main application structure
   */
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
          <button class="add-note-btn" data-action="add-note">+ Note</button>
          <button class="add-checklist-btn" data-action="add-checklist">+ Checklist</button>
          <button class="add-container-btn" data-action="add-container">+ Container</button>
        </div>
        <div class="toolbar-right">
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

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.canvasArea = this.wrapper.querySelector('.canvas-area');
    this.canvasSurface = this.wrapper.querySelector('.canvas-surface');
    this.toolbar = this.wrapper.querySelector('.toolbar');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Keyboard events
    this.wrapper.addEventListener('keydown', this.handleKeyDown);
    
    // Toolbar button clicks (delegated)
    this.toolbar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        this.handleToolbarAction(action);
      }
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

  /**
   * Handle keyboard shortcuts
   */
  handleKeyDown(e) {
    // Ignore if typing in an input
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

  /**
   * Handle toolbar button actions
   */
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
    }
  }

  /**
   * Handle canvas mouse down for panning
   */
  handleCanvasMouseDown(e) {
    // Only pan if clicking on canvas background
    if (e.target === this.canvasArea || 
        e.target === this.canvasSurface || 
        e.target.classList.contains('center-anchor')) {
      this.isPanning = true;
      this.panStart = {
        x: e.clientX - this.panOffset.x,
        y: e.clientY - this.panOffset.y
      };
      this.canvasArea.classList.add('panning');
    }
  }

  /**
   * Handle canvas mouse move for panning
   */
  handleCanvasMouseMove(e) {
    if (!this.isPanning) return;
    
    this.panOffset = {
      x: e.clientX - this.panStart.x,
      y: e.clientY - this.panStart.y
    };
    
    this.updateCanvasTransform();
  }

  /**
   * Handle canvas mouse up - stop panning
   */
  handleCanvasMouseUp() {
    this.isPanning = false;
    this.canvasArea.classList.remove('panning');
  }

  /**
   * Update canvas surface transform
   */
  updateCanvasTransform() {
    this.canvasSurface.style.transform = 
      `translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
  }

  /**
   * Reset view to center of canvas
   */
  resetView() {
    const areaRect = this.canvasArea.getBoundingClientRect();
    const centerX = this.canvasSize / 2;
    const centerY = this.canvasSize / 2;
    
    this.panOffset = {
      x: -(centerX - areaRect.width / 2),
      y: -(centerY - areaRect.height / 2)
    };
    
    this.updateCanvasTransform();
  }

  /**
   * Close the overlay
   */
  handleClose() {
    // Dispatch event to overlay manager
    const event = new CustomEvent('spawn-canvas-close', { bubbles: true, composed: true });
    this.wrapper.dispatchEvent(event);
  }

  /**
   * Deselect all items
   */
  deselectAll() {
    this.selectedItems.forEach(id => {
      const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
      if (element) {
        element.classList.remove('selected');
      }
    });
    this.selectedItems.clear();
  }

  /**
   * Delete selected items
   */
  deleteSelectedItems() {
    if (this.selectedItems.size === 0) return;
    
    this.selectedItems.forEach(id => {
      this.deleteItem(id);
    });
    this.selectedItems.clear();
  }

  /**
   * Navigate through items (1 = prev, 2 = next)
   */
  navigateItems(direction) {
    const itemIds = Array.from(this.items.keys());
    if (itemIds.length === 0) return;
    
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

  /**
   * Select an item
   */
  selectItem(id, addToSelection = false) {
    if (!addToSelection) {
      this.deselectAll();
    }
    
    this.selectedItems.add(id);
    const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
    if (element) {
      element.classList.add('selected');
    }
  }

  /**
   * Pan canvas to show an item
   */
  panToItem(id) {
    const item = this.items.get(id);
    if (!item) return;
    
    const areaRect = this.canvasArea.getBoundingClientRect();
    
    // Center the item in the viewport
    this.panOffset = {
      x: -(item.position.x + item.size.width / 2 - areaRect.width / 2),
      y: -(item.position.y + item.size.height / 2 - areaRect.height / 2)
    };
    
    this.updateCanvasTransform();
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get position for new item (center of current view)
   */
  getNewItemPosition() {
    const areaRect = this.canvasArea.getBoundingClientRect();
    const viewCenterX = -this.panOffset.x + areaRect.width / 2;
    const viewCenterY = -this.panOffset.y + areaRect.height / 2;
    
    // Snap to grid
    const x = Math.round((viewCenterX - 100) / this.gridSize) * this.gridSize;
    const y = Math.round((viewCenterY - 75) / this.gridSize) * this.gridSize;
    
    return { x, y };
  }

  /**
   * Add a new note
   */
  addNote() {
    const id = this.generateId();
    const position = this.getNewItemPosition();
    
    const note = {
      id,
      type: 'note',
      title: '',
      content: '',
      position,
      size: { width: 250, height: 180 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.items.set(id, note);
    this.renderNote(note);
    this.selectItem(id);
    
    // Focus the title input
    setTimeout(() => {
      const titleInput = this.canvasSurface.querySelector(`[data-item-id="${id}"] .item-title`);
      if (titleInput) titleInput.focus();
    }, 0);
  }

  /**
   * Render a note element
   */
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
    
    this.attachItemListeners(element, note);
    this.canvasSurface.appendChild(element);
  }

  /**
   * Add a new checklist
   */
  addChecklist() {
    const id = this.generateId();
    const position = this.getNewItemPosition();
    
    const checklist = {
      id,
      type: 'checklist',
      title: '',
      items: [],
      position,
      size: { width: 280, height: 200 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.items.set(id, checklist);
    this.renderChecklist(checklist);
    this.selectItem(id);
    
    // Focus the title input
    setTimeout(() => {
      const titleInput = this.canvasSurface.querySelector(`[data-item-id="${id}"] .item-title`);
      if (titleInput) titleInput.focus();
    }, 0);
  }

  /**
   * Render a checklist element
   */
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
    
    this.attachItemListeners(element, checklist);
    this.attachChecklistListeners(element, checklist);
    this.canvasSurface.appendChild(element);
  }

  /**
   * Render checklist items HTML
   */
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

  /**
   * Attach checklist-specific listeners
   */
  attachChecklistListeners(element, checklist) {
    const content = element.querySelector('.item-content');
    
    // Add item button
    content.querySelector('.add-checklist-item').addEventListener('click', () => {
      this.addChecklistItem(checklist.id);
    });
    
    // Delegate events for checklist items
    content.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.toggleChecklistItem(checklist.id, itemId, e.target.checked);
      }
    });
    
    content.addEventListener('input', (e) => {
      if (e.target.classList.contains('item-text')) {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.updateChecklistItemText(checklist.id, itemId, e.target.value);
      }
    });
    
    content.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-delete')) {
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.deleteChecklistItem(checklist.id, itemId);
      }
    });
    
    // Handle Enter key to add new item
    content.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('item-text')) {
        e.preventDefault();
        this.addChecklistItem(checklist.id);
      }
      // Tab for indentation
      if (e.key === 'Tab' && e.target.classList.contains('item-text')) {
        e.preventDefault();
        const li = e.target.closest('.checklist-item');
        const itemId = li.dataset.itemId;
        this.toggleChecklistItemNesting(checklist.id, itemId, !e.shiftKey);
      }
    });
  }

  /**
   * Add a new checklist item
   */
  addChecklistItem(checklistId) {
    const checklist = this.items.get(checklistId);
    if (!checklist) return;
    
    const newItem = {
      id: `ci_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: '',
      completed: false,
      nested: 0
    };
    
    checklist.items.push(newItem);
    checklist.updatedAt = Date.now();
    
    // Re-render checklist items
    const element = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"]`);
    const ul = element.querySelector('.checklist-items');
    ul.innerHTML = this.renderChecklistItems(checklist.items);
    
    // Attach listeners and focus new item
    this.attachChecklistListeners(element, checklist);
    
    setTimeout(() => {
      const newInput = ul.querySelector(`[data-item-id="${newItem.id}"] .item-text`);
      if (newInput) newInput.focus();
    }, 0);
  }

  /**
   * Toggle checklist item completion
   */
  toggleChecklistItem(checklistId, itemId, completed) {
    const checklist = this.items.get(checklistId);
    if (!checklist) return;
    
    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      item.completed = completed;
      checklist.updatedAt = Date.now();
      
      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) {
        li.classList.toggle('completed', completed);
      }
    }
  }

  /**
   * Update checklist item text
   */
  updateChecklistItemText(checklistId, itemId, text) {
    const checklist = this.items.get(checklistId);
    if (!checklist) return;
    
    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      item.text = text;
      checklist.updatedAt = Date.now();
    }
  }

  /**
   * Delete checklist item
   */
  deleteChecklistItem(checklistId, itemId) {
    const checklist = this.items.get(checklistId);
    if (!checklist) return;
    
    const index = checklist.items.findIndex(i => i.id === itemId);
    if (index > -1) {
      checklist.items.splice(index, 1);
      checklist.updatedAt = Date.now();
      
      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) li.remove();
    }
  }

  /**
   * Toggle checklist item nesting
   */
  toggleChecklistItemNesting(checklistId, itemId, indent) {
    const checklist = this.items.get(checklistId);
    if (!checklist) return;
    
    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      if (indent && item.nested < 2) {
        item.nested = (item.nested || 0) + 1;
      } else if (!indent && item.nested > 0) {
        item.nested = item.nested - 1;
      }
      checklist.updatedAt = Date.now();
      
      const li = this.canvasSurface.querySelector(`[data-item-id="${checklistId}"] [data-item-id="${itemId}"]`);
      if (li) {
        li.classList.remove('nested-1', 'nested-2');
        if (item.nested > 0) {
          li.classList.add(`nested-${item.nested}`);
        }
      }
    }
  }

  /**
   * Add a new container
   */
  addContainer() {
    const id = this.generateId();
    const position = this.getNewItemPosition();
    
    const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const container = {
      id,
      type: 'container',
      title: '',
      color: randomColor,
      position,
      size: { width: 350, height: 250 },
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.items.set(id, container);
    this.renderContainer(container);
    this.selectItem(id);
    
    // Focus the title input
    setTimeout(() => {
      const titleInput = this.canvasSurface.querySelector(`[data-item-id="${id}"] .item-title`);
      if (titleInput) titleInput.focus();
    }, 0);
  }

  /**
   * Render a container element
   */
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
    
    this.attachItemListeners(element, container);
    this.attachContainerListeners(element, container);
    this.canvasSurface.appendChild(element);
  }

  /**
   * Attach container-specific listeners
   */
  attachContainerListeners(element, container) {
    const colorBtn = element.querySelector('.color-btn');
    
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleContainerColor(container.id);
    });
  }

  /**
   * Cycle through container colors
   */
  cycleContainerColor(containerId) {
    const container = this.items.get(containerId);
    if (!container) return;
    
    const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
    const currentIndex = colors.indexOf(container.color);
    const nextIndex = (currentIndex + 1) % colors.length;
    
    container.color = colors[nextIndex];
    container.updatedAt = Date.now();
    
    const element = this.canvasSurface.querySelector(`[data-item-id="${containerId}"]`);
    if (element) {
      colors.forEach(c => element.classList.remove(`color-${c}`));
      element.classList.add(`color-${container.color}`);
    }
  }

  /**
   * Attach common item listeners (drag, select, delete, etc.)
   */
  attachItemListeners(element, item) {
    // Selection
    element.addEventListener('mousedown', (e) => {
      // Don't select if clicking on input/textarea or buttons
      if (e.target.tagName === 'INPUT' || 
          e.target.tagName === 'TEXTAREA' || 
          e.target.tagName === 'BUTTON' ||
          e.target.classList.contains('resize-handle')) {
        return;
      }
      
      const isShiftClick = e.shiftKey;
      if (!this.selectedItems.has(item.id)) {
        this.selectItem(item.id, isShiftClick);
      }
      
      // Start dragging
      this.startDrag(e, element, item);
    });
    
    // Title input
    const titleInput = element.querySelector('.item-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        item.title = e.target.value;
        item.updatedAt = Date.now();
      });
      
      titleInput.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag start
      });
    }
    
    // Note content
    const noteContent = element.querySelector('.note-content');
    if (noteContent) {
      noteContent.addEventListener('input', (e) => {
        item.content = e.target.value;
        item.updatedAt = Date.now();
      });
      
      noteContent.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    }
    
    // Delete button
    const deleteBtn = element.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(item.id);
      });
    }
    
    // Copy button
    const copyBtn = element.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyItemToClipboard(item.id);
      });
    }
    
    // Resize handles
    const resizeHandles = element.querySelectorAll('.resize-handle');
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.startResize(e, element, item, handle);
      });
    });
  }

  /**
   * Start dragging an item
   */
  startDrag(e, element, item) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...item.position };
    
    element.classList.add('dragging');
    
    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Snap to grid
      const newX = Math.round((startPos.x + deltaX) / this.gridSize) * this.gridSize;
      const newY = Math.round((startPos.y + deltaY) / this.gridSize) * this.gridSize;
      
      item.position.x = Math.max(0, Math.min(newX, this.canvasSize - item.size.width));
      item.position.y = Math.max(0, Math.min(newY, this.canvasSize - item.size.height));
      
      element.style.left = `${item.position.x}px`;
      element.style.top = `${item.position.y}px`;
    };
    
    const onMouseUp = () => {
      element.classList.remove('dragging');
      item.updatedAt = Date.now();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Start resizing an item
   */
  startResize(e, element, item, handle) {
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
      
      if (isRight) {
        const newWidth = Math.max(minWidth, startSize.width + deltaX);
        item.size.width = Math.round(newWidth / this.gridSize) * this.gridSize;
        element.style.width = `${item.size.width}px`;
      }
      
      if (isBottom) {
        const newHeight = Math.max(minHeight, startSize.height + deltaY);
        item.size.height = Math.round(newHeight / this.gridSize) * this.gridSize;
        element.style.height = `${item.size.height}px`;
      }
    };
    
    const onMouseUp = () => {
      item.updatedAt = Date.now();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Delete an item
   */
  deleteItem(id) {
    const element = this.canvasSurface.querySelector(`[data-item-id="${id}"]`);
    if (element) {
      element.remove();
    }
    this.items.delete(id);
    this.selectedItems.delete(id);
  }

  /**
   * Copy item content to clipboard
   */
  async copyItemToClipboard(id) {
    const item = this.items.get(id);
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

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use by overlay-manager
window.CanvasApp = CanvasApp;
