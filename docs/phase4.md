# Phase 4 Execution Plan (Performance & Robustness)

**Goal**: Optimize the application for speed and stability, ensuring it remains responsive even with hundreds of items.

**Status**: ✅ Complete

## 1. Event Delegation Refactor (High Impact) ✅
**Problem**: Currently, every single note/checklist/container has its own set of event listeners (`mousedown`, `input`, `click`, etc.). With many items, this bloats memory and initialization time.
**Solution**: Move to a global Event Delegation model. Attach listeners *once* to the `canvas-surface` or `wrapper` and route events based on `e.target`.

### Execution Steps
1.  **Refactor `canvas/app.js`**:
    -   ✅ Remove `attachItemListeners`, `attachChecklistListeners`, `attachContainerListeners`.
    -   ✅ Centralize `mousedown` logic:
        -   Detect if target is Item (Drag), Handle (Resize), or Input (Focus).
    -   ✅ Centralize `click` logic:
        -   Handle Delete/Copy buttons via `data-action` attributes.
        -   Handle Checkbox toggles.
    -   ✅ Centralize `input` logic:
        -   Route text changes to `Store.updateItem`.
    *   *Result*: O(1) event listeners instead of O(N).

## 2. Rendering Optimization ✅
**Problem**: Re-rendering lists (like checklists) might be expensive if done naively.
**Solution**: Ensure efficient DOM updates.

### Execution Steps
1.  **Optimize `renderChecklistItems`**:
    -   ✅ Verified - already efficient with targeted DOM updates.

## 3. Storage Robustness ✅
**Problem**: `chrome.storage.local` has a 5MB default quota.
**Solution**: Request `unlimitedStorage` permission with a 100MB soft limit warning.

### Execution Steps
1.  **Update `manifest.json`**:
    -   ✅ Added `"unlimitedStorage"` to permissions array.
2.  **Update `canvas/store.js`**:
    -   ✅ Added 100MB soft limit check with "contact developer" warning.

## 4. Memory Management ✅
**Problem**: Detached DOM nodes causing leaks.
**Solution**: Ensure `clearCanvas` and `deleteItem` fully release references.

### Execution Steps
1.  **Audit**: ✅ With event delegation, memory management is now much simpler (no need to remove listeners manually).
2.  **Verify**: ✅ Deleted items are strictly removed from the `items` array and DOM.
