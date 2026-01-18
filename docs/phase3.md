# Phase 3 Execution Plan (Extended Features)

**Goal**: Transform SpawnCanvas from MVP to a robust productivity tool.

## 1. Workspace Management
**Decisions**:
- **Rename**: Browser `prompt()` interaction.
- **Delete**: Browser `confirm()` -> Switch to first available workspace.
- **Viewport**: Always reset to Center (0,0) on switch.
- **Sorting**: Bottom (Chronological).

### Execution Steps
1.  **Modify `canvas/app.js`**:
    -   Update `render()` toolbar HTML to include:
        -   `<button data-action="rename-workspace">✏️</button>`
        -   `<button data-action="delete-workspace">🗑️</button>`
    -   Update `handleToolbarAction` to catch these new actions.
    -   Implement `renameWorkspace()`: Calls Store.saveWorkspace with new name.
    -   Implement `deleteWorkspace()`: Calls Store.deleteWorkspace -> switches ID.
2.  **Modify `canvas/store.js`**:
    -   Add `deleteWorkspace(id)`: Removes data and updates list.

## 2. History System (Undo/Redo)
**Decisions**:
- **Depth**: 42 levels.
- **Scope**: Per-workspace, persistent.
- **Trigger**: Debounced on text edit, immediate on drag/resize end.
- **UI**: Visible Buttons (↩️ ↪️) + Keyboard Shortcuts (`Ctrl+Z`, `Ctrl+Y`).

### Execution Steps
1.  **Create `canvas/core/history.js`**:
    -   Class `HistoryManager` with `undoStack` and `redoStack`.
    -   Methods: `push(state)`, `undo()`, `redo()`.
    -   `state` = Deep copy of `workspace.items`.
2.  **Integrate in `canvas/app.js`**:
    -   Instantiate `this.history = new HistoryManager(Store)`.
    -   Update `render()` toolbar HTML to include Undo/Redo buttons.
    -   Listen for shortcuts: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo).
    -   **Hooks**:
        -   `onDragEnd` -> `history.push()`
        -   `onResizeEnd` -> `history.push()`
        -   `onItemAdd/Delete` -> `history.push()`
        -   `onTextChange` -> `history.push()` (Debounced 1000ms).

## 3. Advanced Selection (The "Blue Box")
**Decisions**:
- **Trigger**: Drag on empty space.
- **Rule**: "Touch" intersection (any overlap selects).
- **Z-Index**: Bring to front on selection.
- **Clear**: Click on empty space clears selection.
- **Modifiers**: Shift+Click to add/remove.
- **Pan Strategy**: Space+Drag.
- **Wheel Scroll**: Disabled (Reserved for Zoom).
- **Resize Limit**: Hard stop at content size.
- **Grid Snapping**: Always On (No disable).

### Execution Steps
1.  **Modify `canvas/app.js`**:
    -   `handleCanvasMouseDown`: Detect if target is `canvas-surface` (empty space).
    -   If empty space -> Start Selection Drag Mode.
    -   Render `<div class="selection-box">` overlay.
    -   `handleMouseMove`: Update box `width/height/top/left`.
    -   `checkIntersection()`: Loop through all items:
        -   If `intersect(box, item)` -> Add to `selectedItems` set -> Visual highlight.
2.  **Z-Index Logic**:
    -   `bringToFront(itemId)`: Re-append element to parent (simplest DOM way to boost z-index).

## 4. Container Logic (Implicit Grouping)
**Decisions**:
- **Behavior**: Dragging container moves all items "inside" it.
- **Threshold**: Item center point must be within container bounds.
- **Breakout**: Drag item out of container to ungroup.
- **Item Deletion**: Always confirm dialog before deleting any item (Click or Keypress).
- **Paste**: Center of Viewport.
- **Duplicate**: Offset (+20px).
- **Default Note Color**: Neutral (Gray/White).
- **Auto-Focus**: Title field.
- **Double-Click Canvas**: No action.
- **Checklist Enter**: Create new item.
- **Container Title**: Always visible.
- **Empty Checklist**: Allow empty items (for spacing).
- **Escape Key**: Unfocus input first (2nd press closes).
- **Tab Key**: Indent/Outdent (Sub-tasking).
- **Max Indent**: 3 Levels.
- **Completed Style**: Strikethrough + Dim.
- **Clipboard Copy**: Markdown Checkboxes (Preserve State).
- **Links**: Click -> Confirm; Backspace -> Unlink.
- **Context Menu**: Custom (Shift+RightClick for native).
- **Shortcut Hints**: Tooltips + Help Modal.
- **Export Format**: JSON (Full Backup).
- **Import Strategy**: Create New Workspace (Safe).
- **Focus**: No Trap (Allow page interaction).
