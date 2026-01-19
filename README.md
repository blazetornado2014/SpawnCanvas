# SpawnCanvas

SpawnCanvas is a persistent floating canvas overlay for project planning, directly in your browser.

## Installation

SpawnCanvas is currently in **Developer Mode**. To install it:

### Chrome / Edge / Brave

1.  **Download/Clone** this repository to a folder on your computer.
2.  Open your browser and navigate to the Extensions management page:
    *   **Chrome**: `chrome://extensions`
    *   **Edge**: `edge://extensions`
3.  Enable **Developer mode** (usually a toggle in the top right corner).
4.  Click the **Load unpacked** button.
5.  Select the folder where you downloaded this repository (the folder containing `manifest.json`).

The **SpawnCanvas** icon should now appear in your browser toolbar!

## Usage

1.  **Open the Overlay**: Click the SpawnCanvas extension icon in your toolbar.
    *   *Note: Works on any web page (http/https), but not on internal browser pages like `chrome://newtab`.*

2.  **Add Items**: Use the toolbar buttons to add:
    *   **Notes**: Plain text for ideas and content.
    *   **Checklists**: Task lists with nested items (Tab to indent).
    *   **Containers**: Colored boxes to group related items visually.

3.  **Navigate the Canvas**:
    *   **Pan**: Hold `Space` and drag the mouse.
    *   **Reset View**: Press `Home` or `0` to return to center.

4.  **Select Items**:
    *   **Click** an item to select it.
    *   **Shift+Click** to add/remove from selection.
    *   **Drag on empty canvas** to box-select multiple items.

5.  **Edit Items**:
    *   Click text fields to edit titles and content.
    *   Drag items to move them (snaps to grid).
    *   Drag resize handles (corners/edges) to resize.
    *   Containers automatically move items inside them when dragged.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space + Drag` | Pan canvas |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + Shift + Z` | Redo (alternative) |
| `Home` / `0` | Reset view to center |
| `Esc` | Close overlay / Unfocus text |
| `Delete` / `Backspace` | Delete selected items |
| `1` | Navigate to previous item |
| `2` | Navigate to next item |

### Checklist Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Add new item |
| `Tab` | Indent item (max 2 levels) |
| `Shift + Tab` | Outdent item |

## Features

### Workspaces
- Create multiple workspaces from the dropdown menu.
- Switch between workspaces to organize different projects.
- Rename or delete workspaces via the Settings menu (gear icon).

### Undo/Redo
- 42 levels of undo/redo history.
- History is saved per workspace and persists across sessions.

### Export/Import
- **Export Workspace**: Save current workspace as a JSON file.
- **Export All**: Save all workspaces to a single backup file.
- **Import Workspace**: Load a single workspace from a backup.
- **Import All**: Restore all workspaces from a backup file.

Access export options from the Settings menu. Import options are in the workspace dropdown.

### Containers
- 8 color options (click the palette icon to cycle colors).
- Items whose center is inside a container move with it when dragged.

### Selection
- Box-select by dragging on empty canvas space.
- Multi-select with Shift+Click.
- Delete multiple selected items at once.

## Tips

- **Copy to Clipboard**: Hover over a note/checklist and click the clipboard icon to copy its content as text.
- **Checklist Formatting**: Copied checklists include checkboxes as `[x]` or `[ ]` with proper indentation.
- **Data Safety**: Use Export All regularly to backup your workspaces.
