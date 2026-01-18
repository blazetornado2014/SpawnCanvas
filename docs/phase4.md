# Phase 4 Execution Plan (Performance & Robustness)

**Goal**: Optimize the application for speed and stability, ensuring it remains responsive even with hundreds of items.

## 1. Event Delegation Refactor (High Impact)
**Problem**: Currently, every single note/checklist/container has its own set of event listeners (`mousedown`, `input`, `click`, etc.). With many items, this bloats memory and initialization time.
**Solution**: Move to a global Event Delegation model. Attach listeners *once* to the `canvas-surface` or `wrapper` and route events based on `e.target`.

### Execution Steps
1.  **Refactor `canvas/app.js`**:
    -   Remove `attachItemListeners`, `attachChecklistListeners`, `attachContainerListeners`.
    -   Centralize `mousedown` logic:
        -   Detect if target is Item (Drag), Handle (Resize), or Input (Focus).
    -   Centralize `click` logic:
        -   Handle Delete/Copy buttons via `data-action` attributes.
        -   Handle Checkbox toggles.
    -   Centralize `input` logic:
        -   Route text changes to `Store.updateItem`.
    *   *Result*: O(1) event listeners instead of O(N).

## 2. Rendering Optimization
**Problem**: Re-rendering lists (like checklists) might be expensive if done naively.
**Solution**: Ensure efficient DOM updates.

### Execution Steps
1.  **Optimize `renderChecklistItems`**:
    -   Minimize DOM thrashing when adding/toggling items.
    -   (Already fairly efficient, but will verify during refactor).

## 3. Storage Robustness
**Problem**: `chrome.storage.local` has quotas, and `localStorage` (if used as backup) is synchronous. Data loss can occur if save fails.
**Solution**: Robust error handling.

### Execution Steps
1.  **Update `canvas/store.js`**:
    -   Catch `QUOTA_EXCEEDED` errors.
    -   Alert user if save fails (via `alert` or simple console warning if specialized UI is skipped).
    -   Verify `beforeunload` strategy (best effort).

## 4. Memory Management
**Problem**: Detached DOM nodes causing leaks.
**Solution**: Ensure `clearCanvas` and `deleteItem` fully release references.

### Execution Steps
1.  **Audit**: With event delegation, memory management becomes much simpler (no need to remove listeners manually).
2.  **Verify**: Check that deleted items are strictly removed from the `items` array and DOM.
