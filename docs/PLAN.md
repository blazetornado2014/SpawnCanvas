# SpawnCanvas - Project Plan

> A cross-browser extension that provides a floating canvas overlay for organizing project plans with checklists and notes.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals](#goals)
3. [Feature Specifications](#feature-specifications)
4. [Technical Architecture](#technical-architecture)
5. [Data Models](#data-models)
6. [UI/UX Specifications](#uiux-specifications)
7. [Implementation Phases](#implementation-phases)
8. [MVP vs Future Features](#mvp-vs-future-features)

---

## Problem Statement

### The Core Problem
An app removed their canvas feature that was essential for project planning. The replacement relies on memory/context that is unreliable due to compaction and other issues. Users lose track of:
- Step-by-step plans created during planning sessions
- Alternative approaches discussed for when something doesn't work
- Ideas for later or other projects
- Overall project goals and deadline checklists

### What SpawnCanvas Solves
- **Persistent storage**: Plans are saved locally, never lost to memory compaction
- **Visual organization**: Freeform canvas lets users spatially organize related items
- **Quick access**: Floating overlay means instant toggle without leaving current work
- **Reliability**: Local-first, offline-capable, no dependency on external services

---

## Goals

### Primary Goals
1. Provide a reliable, persistent canvas for project planning
2. Support checklists with nested items for step-by-step tracking
3. Support notes for capturing ideas and context
4. Allow visual grouping of related items via containers
5. Work across all major browsers with identical functionality

### Non-Goals (for MVP)
- Collaboration / sharing features
- Cloud sync
- AI-powered features
- Integration with external tools
- Mobile support

---

## Feature Specifications

### 1. Canvas Core

| Feature | Specification |
|---------|---------------|
| **Type** | Freeform, bounded (not infinite) |
| **Theme** | Dark mode - black background |
| **Grid** | Subtle dull white grid lines for placement guidance |
| **Navigation** | Pan by dragging canvas background |
| **Center Anchor** | Keyboard shortcut snaps view back to center |
| **Item Queue Navigation** | Press `1` to go to previous item, `2` to go to next item (creation order) |

### 2. Workspaces

| Feature | Specification |
|---------|---------------|
| **Multiple Workspaces** | Users can create/switch between different canvases |
| **Naming** | Each workspace has a user-defined name |
| **Isolation** | Items in one workspace are independent from others |
| **Persistence** | All workspaces saved to local storage |

### 3. Content Types

#### 3.1 Checklists
| Feature | Specification |
|---------|---------------|
| **Title** | Required, displayed at top of checklist |
| **Items** | Plain text checklist items |
| **Nesting** | Support sub-items (at least 2 levels deep) |
| **Checkboxes** | Click to mark complete/incomplete |
| **Copy** | Copy button copies formatted text to clipboard |
| **Export** | Export individual checklist to JSON |

#### 3.2 Notes
| Feature | Specification |
|---------|---------------|
| **Title** | Required, displayed at top of note |
| **Content** | Plain text (no rich text/markdown for MVP) |
| **Copy** | Copy button copies formatted text to clipboard |
| **Export** | Export individual note to JSON |

#### 3.3 Containers
| Feature | Specification |
|---------|---------------|
| **Purpose** | Group related checklists/notes together |
| **Title** | Optional title for the container |
| **Color-coding** | User-defined background colors with custom labels |
| **Contents** | Can hold multiple checklists and notes |
| **Nesting** | Containers cannot nest inside other containers |

### 4. Item Manipulation

| Feature | Specification |
|---------|---------------|
| **Positioning** | Free-form drag anywhere on canvas |
| **Resizing** | Drag corners/edges to resize |
| **Minimum Size** | Auto-calculated to always fit content |
| **Selection** | Click to select single item |
| **Multi-select** | Drag selection box (like Windows) to select multiple |
| **Bulk Actions** | Delete, move selected items together |
| **Delete** | Remove items permanently (no archive/hide) |

### 5. Undo/Redo

| Feature | Specification |
|---------|---------------|
| **Depth** | 4 levels in each direction |
| **Scope** | Per-workspace history |
| **Actions Tracked** | Create, delete, move, resize, edit content |

### 6. Search

| Feature | Specification |
|---------|---------------|
| **Scope** | Search across all workspaces |
| **Targets** | Titles, checklist items, note content |
| **Results** | Show matching items with workspace context |
| **Navigation** | Click result to jump to item in its workspace |

### 7. Data Management

| Feature | Specification |
|---------|---------------|
| **Storage** | Browser local storage |
| **Offline** | Fully functional without internet |
| **Export** | Individual items to JSON |
| **Copy** | Formatted plain text to clipboard |
| **Paste** | Standard paste functionality supported |

### 8. Browser Extension

| Feature | Specification |
|---------|---------------|
| **Activation** | Click extension icon to toggle overlay |
| **Overlay** | Floating panel over current page |
| **Browsers** | Chrome, Firefox, Edge, Safari |
| **Manifest** | Version 3 (for Chrome/Edge), with Firefox/Safari adaptations |

---

## Technical Architecture

### Extension Structure

```
SpawnCanvas/
├── manifest.json          # Extension manifest (MV3)
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   └── content.js         # Content script (injects overlay)
├── popup/
│   ├── popup.html         # Extension popup (optional settings)
│   └── popup.js
├── canvas/
│   ├── index.html         # Canvas overlay HTML
│   ├── canvas.js          # Main canvas logic
│   ├── canvas.css         # Styles
│   ├── components/
│   │   ├── Checklist.js   # Checklist component
│   │   ├── Note.js        # Note component
│   │   ├── Container.js   # Container component
│   │   └── Toolbar.js     # Canvas toolbar
│   └── utils/
│       ├── storage.js     # Local storage operations
│       ├── history.js     # Undo/redo management
│       └── search.js      # Search functionality
├── shared/
│   ├── constants.js       # Shared constants
│   └── types.js           # Type definitions (JSDoc)
└── assets/
    └── icons/             # Extension icons
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Extension API** | WebExtensions API (cross-browser) |
| **UI Framework** | Vanilla JS (lightweight, no framework dependency) |
| **Styling** | CSS with CSS Variables for theming |
| **Storage** | chrome.storage.local / browser.storage.local |
| **Build** | None required for MVP (or simple bundler if needed) |

### Cross-Browser Strategy

1. **Primary Development**: Chrome (Manifest V3)
2. **Firefox Adaptation**: 
   - Use `browser.*` namespace (or polyfill)
   - Adjust manifest for Firefox compatibility
3. **Edge**: Compatible with Chrome extension (minimal changes)
4. **Safari**: 
   - Use Safari Web Extension converter
   - May require Xcode for packaging

### Overlay Implementation

The canvas will be injected as an iframe or shadow DOM element to:
- Isolate styles from host page
- Prevent conflicts with page JavaScript
- Ensure consistent rendering across sites

```
+---------------------------------------------+
| Browser Tab                                 |
|  +---------------------------------------+  |
|  | Web Page Content                      |  |
|  |                                       |  |
|  |  +--------------------------------+   |  |
|  |  | SpawnCanvas Overlay            |   |  |
|  |  | (iframe / shadow DOM)          |   |  |
|  |  |                                |   |  |
|  |  |  [Canvas Content Here]         |   |  |
|  |  |                                |   |  |
|  |  +--------------------------------+   |  |
|  |                                       |  |
|  +---------------------------------------+  |
+---------------------------------------------+
```

---

## Data Models

### Workspace

```javascript
{
  id: string,              // UUID
  name: string,            // User-defined name
  createdAt: timestamp,
  updatedAt: timestamp,
  viewportX: number,       // Current pan position X
  viewportY: number,       // Current pan position Y
  items: string[],         // Array of item IDs (creation order for queue)
  currentQueueIndex: number // Current position in item queue
}
```

### Checklist

```javascript
{
  id: string,              // UUID
  type: "checklist",
  workspaceId: string,     // Parent workspace
  containerId: string|null,// Parent container (if grouped)
  title: string,
  items: [
    {
      id: string,
      text: string,
      completed: boolean,
      children: [           // Nested items
        {
          id: string,
          text: string,
          completed: boolean
        }
      ]
    }
  ],
  position: { x: number, y: number },
  size: { width: number, height: number },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Note

```javascript
{
  id: string,              // UUID
  type: "note",
  workspaceId: string,
  containerId: string|null,
  title: string,
  content: string,         // Plain text
  position: { x: number, y: number },
  size: { width: number, height: number },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Container

```javascript
{
  id: string,              // UUID
  type: "container",
  workspaceId: string,
  title: string,           // Optional
  color: string,           // Background color (hex)
  colorLabel: string,      // User-defined label for this color
  position: { x: number, y: number },
  size: { width: number, height: number },
  children: string[],      // IDs of contained items
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Color Labels (User-Defined)

```javascript
{
  colors: [
    { hex: "#FF6B6B", label: "Urgent" },
    { hex: "#4ECDC4", label: "In Progress" },
    { hex: "#45B7D1", label: "Feature" },
    // ... user can add/edit/remove
  ]
}
```

### History State (Undo/Redo)

```javascript
{
  workspaceId: string,
  undoStack: [             // Max 4 items
    { action: string, data: object, timestamp: timestamp }
  ],
  redoStack: [             // Max 4 items
    { action: string, data: object, timestamp: timestamp }
  ]
}
```

---

## UI/UX Specifications

### Overlay Appearance

```
+----------------------------------------------------------------+
| [Workspace Dropdown v]  [+ Checklist] [+ Note] [+ Container]   |
| [Search]                                 [Center] [Close X]    |
+----------------------------------------------------------------+
|                                                                |
|    +------------------+                                        |
|    | Container        |    +--------------+                    |
|    | (colored bg)     |    | Note Title   |                    |
|    |                  |    | ------------ |                    |
|    | +-------------+  |    | Note content |                    |
|    | | Checklist   |  |    | goes here... |                    |
|    | | [ ] Item 1  |  |    |         [cp] |                    |
|    | |   [ ] Sub 1 |  |    +--------------+                    |
|    | | [x] Item 2  |  |                                        |
|    | |        [cp] |  |                                        |
|    | +-------------+  |                                        |
|    |                  |                                        |
|    +------------------+                     *  (center anchor) |
|                                                                |
|                              Grid lines (subtle, dull white)   |
|                                                                |
+----------------------------------------------------------------+
```

### Color Scheme (Dark Mode)

| Element | Color |
|---------|-------|
| Canvas Background | `#0D0D0D` (near black) |
| Grid Lines | `#2A2A2A` (dull white/gray) |
| Item Background | `#1A1A1A` |
| Item Border | `#333333` |
| Text Primary | `#FFFFFF` |
| Text Secondary | `#AAAAAA` |
| Accent/Interactive | `#4A9EFF` |
| Checkbox Checked | `#4ADE80` |
| Container Colors | User-defined palette |

### Interaction States

| State | Visual Feedback |
|-------|-----------------|
| Hover (item) | Subtle border highlight |
| Selected | Blue border, resize handles visible |
| Multi-selected | Blue border on all selected |
| Dragging | Slight opacity reduction, shadow |
| Selection box | Blue dashed rectangle |

### Toolbar

- **Workspace Dropdown**: Switch between workspaces, create new, rename, delete
- **Add Buttons**: Create new Checklist, Note, or Container
- **Search**: Opens search panel/modal
- **Center Button**: Snap viewport to center anchor
- **Close Button**: Hide overlay (toggle off)

### Item Controls

Each item (Checklist/Note) has:
- **Title bar**: Drag handle, title text
- **Copy button** (clipboard icon): Copy formatted content to clipboard
- **Export button** (optional, or in menu): Export to JSON
- **Delete button** (trash icon): Remove item
- **Resize handles**: Corner and edge handles when selected

### Keyboard Controls

| Key | Action |
|-----|--------|
| `1` | Navigate to previous item in queue |
| `2` | Navigate to next item in queue |
| `Home` or custom | Snap to center anchor |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected items |
| `Escape` | Deselect all / Close overlay |

---

## Implementation Phases

### Phase 1: Foundation (MVP Core)
**Goal**: Basic extension with canvas overlay and single workspace

- [ ] Set up extension manifest (Chrome MV3)
- [ ] Create background service worker
- [ ] Implement content script for overlay injection
- [ ] Build basic canvas with dark theme + grid
- [ ] Implement pan navigation
- [ ] Create Note component (create, edit, delete)
- [ ] Create Checklist component (flat items only)
- [ ] Implement local storage save/load
- [ ] Add center anchor + snap-to-center

### Phase 2: Core Features
**Goal**: Full item functionality and containers

- [ ] Add nested checklist items (sub-tasks)
- [ ] Create Container component
- [ ] Implement color-coding for containers
- [ ] User-defined color labels
- [ ] Item resizing with minimum size enforcement
- [ ] Copy to clipboard (formatted text)
- [ ] Export to JSON

### Phase 3: Multi-Workspace & Navigation
**Goal**: Multiple workspaces and navigation features

- [ ] Workspace management (create, switch, rename, delete)
- [ ] Item queue navigation (1/2 keys)
- [ ] Undo/redo system (4 levels)
- [ ] Drag selection box for multi-select
- [ ] Bulk operations (move, delete selected)

### Phase 4: Search & Polish
**Goal**: Search functionality and UX refinements

- [ ] Global search across workspaces
- [ ] Search results with navigation
- [ ] UI polish and animations
- [ ] Error handling and edge cases
- [ ] Performance optimization

### Phase 5: Cross-Browser
**Goal**: Support all target browsers

- [ ] Firefox adaptation and testing
- [ ] Edge testing (should work with Chrome version)
- [ ] Safari Web Extension conversion
- [ ] Cross-browser testing and fixes

---

## MVP vs Future Features

### MVP (Version 1.0)

| Category | Features |
|----------|----------|
| **Canvas** | Dark theme, grid, bounded, pan navigation |
| **Items** | Notes (plain text), Checklists (nested), Containers (color-coded) |
| **Core** | Create, edit, delete, move, resize items |
| **Navigation** | Center anchor, item queue (1/2 keys) |
| **Data** | Local storage, copy to clipboard, JSON export |
| **Selection** | Single select, multi-select with drag box |
| **History** | Undo/redo (4 levels) |
| **Search** | Cross-workspace search |
| **Browsers** | Chrome (primary), Firefox, Edge |

### Future Features (Version 2.0+)

| Feature | Description |
|---------|-------------|
| **Zoom** | Zoom in/out on canvas |
| **Themes** | Light mode, custom themes |
| **Keyboard Shortcuts** | Comprehensive shortcut system |
| **Context Menus** | Right-click menus for quick actions |
| **Filtering** | Filter by label, completion status |
| **Templates** | Pre-made workspace templates |
| **Safari Support** | Full Safari Web Extension |
| **Rich Text Notes** | Markdown or rich text editing |
| **More Content Types** | Images, links, code snippets |
| **Cloud Sync** | Optional sync across devices |
| **Collaboration** | Share workspaces with others |

---

## Open Questions / Decisions

1. **Overlay Size**: Should the overlay be full-screen, or a fixed/resizable panel? 
   - Recommendation: Resizable with a default comfortable size (e.g., 80% viewport)

2. **Canvas Bounds**: What should the bounded canvas size be?
   - Recommendation: Large enough for practical use (e.g., 5000x5000px virtual space)

3. **Persistence Frequency**: Save on every change, or debounced/on-close?
   - Recommendation: Debounced save (300ms after last change) + save on close

4. **Item Z-Index**: How to handle overlapping items?
   - Recommendation: Click/select brings to front, track z-order in data model

5. **Extension Icon Click Behavior**: Toggle overlay on current tab only, or global state?
   - Recommendation: Per-tab toggle (different pages might need different contexts)

---

## Success Criteria

The MVP is complete when a user can:

1. Click the extension icon to open a floating canvas overlay
2. Create a new workspace and give it a name
3. Add checklists with nested items and check them off
4. Add notes with plain text content
5. Create containers and put checklists/notes inside them
6. Color-code containers with custom labels
7. Drag items anywhere on the canvas
8. Resize items (respecting minimum content size)
9. Pan around the canvas
10. Press a key to snap back to center
11. Navigate between items using 1/2 keys
12. Select multiple items with a drag selection box
13. Delete single or multiple items
14. Copy item content to clipboard as formatted text
15. Export individual items to JSON
16. Undo/redo up to 4 actions
17. Search for items across all workspaces
18. Close the overlay and have everything persist
19. Reopen and find everything exactly as left

---

*Last Updated: January 6, 2026*
