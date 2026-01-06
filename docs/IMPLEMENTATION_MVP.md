# SpawnCanvas MVP Implementation Plan

**Goal**: Create a browser extension (Chrome MV3) that provides a persistent, floating canvas overlay for notes and checklists.
**Core Philosophy**: Local-first, Vanilla JS (no heavy frameworks), Shadow DOM for isolation.

## User Review Required
> [!IMPORTANT]
> **MVP Scope Reductions** (Agreed in Q&A):
> - **No Search**: Deferred to v2.
> - **No Undo/Redo**: Deferred to v2.
> - **No JSON Export**: Copy to Clipboard only.
> - **Simplified Selection**: Shift+Click (no drag-box).
> - **Fixed Colors**: 8 preset colors for containers (user-editable labels).
> - **Chrome Only**: Firefox/Edge deferred.
> - **Fixed HUD**: Canvas `position: fixed` relative to viewport, independent scroll.
> - **Manual Clipping**: No auto-clip button.
> - **Deferred Tab Sync**: Updates on reload/reopen.
> - **Reset View**: Center anchor is sufficient.

## Proposed Architecture
We will follow the `PLAN.md` architecture but simplified for MVP.

**Directory Structure**:
```text
/
├── manifest.json
├── background/
│   └── service-worker.js    # Toggles the overlay
├── content/
│   ├── overlay-manager.js   # injects/removes Shadow DOM
│   └── bridge.js            # Future-proofing: comms between page and canvas
├── canvas/                  # All logic runs inside the content script context (shadow DOM)
│   ├── main.css             # CSS Variables, Dark theme
│   ├── store.js             # State management (Pub/Sub + LocalStorage)
│   ├── app.js               # Entry point
│   ├── core/
│   │   ├── drag-system.js   # Handling element dragging/resizing
│   │   └── pan-zoom.js      # Canvas navigation
│   └── components/
│       ├── base-item.js     # Shared logic (selection, context menu?)
│       ├── note.js
│       ├── checklist.js
│       ├── container.js
│       └── toolbar.js
└── assets/
    └── icons/
```

## Proposed Changes

### 1. Project Scaffolding
#### [NEW] [manifest.json](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/manifest.json)
- Define MV3 manifest.
- Permissions: `storage`, `activeTab`, `scripting`.
- Host permissions: `<all_urls>` (for overlay).

#### [NEW] [service-worker.js](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/background/service-worker.js)
- Listen for action click -> send message to content script to toggle "visible" state.

### 2. Core Overlay Engine
#### [NEW] [overlay-manager.js](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/content/overlay-manager.js)
- Creates a host element (e.g., `<spawn-canvas-root>`).
- Attaches Shadow DOM `open`.
- Injects styles.
- Mounts the `CanvasApp`.

### 3. State Management
#### [NEW] [store.js](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/canvas/store.js)
- Simple Pub/Sub event emitter.
- methods: `createItem`, `updateItem`, `deleteItem`, `saveWorkspace`.
- auto-save to `chrome.storage.local` (debounced).

### 4. Interactive Canvas
#### [NEW] [drag-system.js](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/canvas/core/drag-system.js)
- Mouse event listeners for dragging items.
- Grid snapping logic (20px grid?).

#### [NEW] [components/...](file:///c:/Users/blaze/OneDrive/Documents/GitHub/SpawnCanvas/canvas/components/)
- **Note.js**: Plain `textarea` or `contenteditable`.
- **Checklist.js**: List of inputs + checkboxes. Supports indentation (margin-left).
- **Container.js**: Div with background color. Logic to "capture" items dropped on it.

## Verification Plan

### Automated Tests
- Minimal unit tests for the `store.js` logic (optional for MVP speed).

### Manual Verification
1. **Load Extension**: Load unpacked in Chrome.
2. **Toggle**: Click icon on any webpage -> verify overlay appears.
3. **Persistence**: Reload page -> verify overlay state remains (or restores on toggle).
4. **CRUD**:
   - Create Note -> Edit text -> Reload -> Verify text.
   - Create Checklist -> Add items -> Check item -> Reload.
   - Create Container -> Drag items in -> Move container -> Verify items move with it.
   - Delete item -> Verify gone.
5. **Isolation**: ensure page CSS doesn't bleed into overlay (Shadow DOM check).
