/**
 * Overlay Manager
 * Creates and manages the Shadow DOM host for SpawnCanvas overlay.
 * Handles toggle visibility messages from the background service worker.
 */

(function () {
  'use strict';

  const HOST_ID = 'spawn-canvas-root';
  let hostElement = null;
  let shadowRoot = null;
  let canvasApp = null;
  let isVisible = false;
  let isInitialized = false;

  /**
   * Load CSS from the canvas/main.css file
   * Since we can't directly import in content scripts, we fetch and inject
   */
  async function loadStyles() {
    try {
      const cssUrl = chrome.runtime.getURL('canvas/main.css');
      const response = await fetch(cssUrl);
      const cssText = await response.text();
      return cssText;
    } catch (err) {
      console.warn('[SpawnCanvas] Could not load external CSS, using inline styles:', err);
      return getInlineStyles();
    }
  }

  /**
   * Fallback inline styles if external CSS fails to load
   */
  function getInlineStyles() {
    return `
      :host {
        --canvas-bg: #0D0D0D;
        --grid-color: #2A2A2A;
        --item-bg: #1A1A1A;
        --item-border: #333333;
        --item-border-hover: #444444;
        --text-primary: #FFFFFF;
        --text-secondary: #AAAAAA;
        --text-muted: #666666;
        --accent: #4A9EFF;
        --accent-hover: #6BB3FF;
        --checkbox-checked: #4ADE80;
        --danger: #EF4444;
        --toolbar-bg: #151515;
        --toolbar-border: #2A2A2A;
        --container-red: #FF6B6B;
        --container-orange: #FFA94D;
        --container-yellow: #FFE066;
        --container-green: #69DB7C;
        --container-teal: #38D9A9;
        --container-blue: #4DABF7;
        --container-purple: #B197FC;
        --container-pink: #F783AC;
        --toolbar-height: 48px;
        --grid-size: 20px;
        --canvas-size: 5000px;
        --transition-fast: 0.1s ease;
        --transition-normal: 0.15s ease;
      }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .spawn-canvas-wrapper {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-color: var(--canvas-bg); pointer-events: auto; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; color: var(--text-primary); line-height: 1.4;
      }
      .toolbar {
        position: absolute; top: 0; left: 0; right: 0; height: var(--toolbar-height);
        background: var(--toolbar-bg); border-bottom: 1px solid var(--toolbar-border);
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 16px; z-index: 1000; user-select: none;
      }
      .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; }
      .toolbar button {
        background: var(--item-bg); border: 1px solid var(--item-border);
        color: var(--text-primary); padding: 8px 12px; border-radius: 4px;
        cursor: pointer; font-size: 13px; font-weight: 500;
      }
      .toolbar button:hover { background: var(--item-border); }
      .toolbar .icon-btn { background: transparent; border: none; color: var(--text-secondary); padding: 8px; }
      .toolbar .icon-btn:hover { color: var(--text-primary); }
      .toolbar .close-btn { font-size: 24px; padding: 4px 8px; }
      .workspace-selector {
        background: var(--item-bg); border: 1px solid var(--item-border);
        color: var(--text-primary); padding: 8px 12px; border-radius: 4px; font-size: 13px;
      }
      .canvas-area {
        position: absolute; top: var(--toolbar-height); left: 0; right: 0; bottom: 0;
        overflow: hidden; cursor: grab;
      }
      .canvas-area:active, .canvas-area.panning { cursor: grabbing; }
      .canvas-surface {
        position: absolute; width: var(--canvas-size); height: var(--canvas-size);
        background-color: var(--canvas-bg);
        background-image: linear-gradient(var(--grid-color) 1px, transparent 1px),
                          linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
        background-size: var(--grid-size) var(--grid-size);
        transform-origin: 0 0; will-change: transform;
      }
      .center-anchor {
        position: absolute; top: calc(var(--canvas-size) / 2); left: calc(var(--canvas-size) / 2);
        width: 12px; height: 12px; background: var(--accent); border-radius: 50%;
        transform: translate(-50%, -50%); opacity: 0.4; pointer-events: none;
      }
      .canvas-item {
        position: absolute; background: var(--item-bg); border: 1px solid var(--item-border);
        border-radius: 6px; min-width: 200px; min-height: 100px; cursor: move; user-select: none;
      }
      .canvas-item:hover { border-color: var(--item-border-hover); }
      .canvas-item.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
      .canvas-item.dragging { opacity: 0.9; z-index: 500; }
      .item-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 12px; border-bottom: 1px solid var(--item-border); cursor: move; gap: 8px;
      }
      .item-title {
        flex: 1; min-width: 0; font-weight: 500; font-size: 14px; color: var(--text-primary);
        background: transparent; border: none; outline: none; font-family: inherit;
      }
      .item-title::placeholder { color: var(--text-muted); }
      .item-actions { display: flex; gap: 4px; opacity: 0; transition: opacity var(--transition-fast); }
      .canvas-item:hover .item-actions, .canvas-item.selected .item-actions { opacity: 1; }
      .item-actions button {
        background: transparent; border: none; color: var(--text-secondary);
        cursor: pointer; padding: 4px 6px; font-size: 12px; border-radius: 3px;
      }
      .item-actions button:hover { background: var(--item-border); color: var(--text-primary); }
      .item-actions .delete-btn:hover { background: var(--danger); color: white; }
      .item-content { padding: 12px; overflow: hidden; }
      .note-content {
        width: 100%; min-height: 60px; background: transparent; border: none;
        color: var(--text-primary); font-size: 13px; line-height: 1.5;
        resize: none; outline: none; font-family: inherit;
      }
      .note-content::placeholder { color: var(--text-muted); }
      .checklist-items { list-style: none; display: flex; flex-direction: column; gap: 4px; }
      .checklist-item { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; }
      .checklist-item.nested-1 { margin-left: 20px; }
      .checklist-item.nested-2 { margin-left: 40px; }
      .checklist-item input[type="checkbox"] {
        margin-top: 2px; width: 16px; height: 16px; accent-color: var(--checkbox-checked); cursor: pointer;
      }
      .checklist-item .item-text {
        flex: 1; min-width: 0; background: transparent; border: none;
        color: var(--text-primary); font-size: 13px; outline: none; font-family: inherit;
      }
      .checklist-item.completed .item-text { color: var(--text-secondary); text-decoration: line-through; }
      .checklist-item .item-delete {
        opacity: 0; background: transparent; border: none; color: var(--text-secondary);
        cursor: pointer; padding: 2px 4px; font-size: 12px;
      }
      .checklist-item:hover .item-delete { opacity: 1; }
      .checklist-item .item-delete:hover { color: var(--danger); }
      .add-checklist-item {
        display: flex; align-items: center; gap: 8px; padding: 4px 0;
        color: var(--text-muted); cursor: pointer; font-size: 13px;
      }
      .add-checklist-item:hover { color: var(--text-secondary); }
      .canvas-item.container { background: rgba(255, 255, 255, 0.03); min-width: 300px; min-height: 200px; }
      .container-color-bar { height: 4px; border-radius: 6px 6px 0 0; margin: -1px -1px 0 -1px; }
      .container.color-red .container-color-bar { background: var(--container-red); }
      .container.color-orange .container-color-bar { background: var(--container-orange); }
      .container.color-yellow .container-color-bar { background: var(--container-yellow); }
      .container.color-green .container-color-bar { background: var(--container-green); }
      .container.color-teal .container-color-bar { background: var(--container-teal); }
      .container.color-blue .container-color-bar { background: var(--container-blue); }
      .container.color-purple .container-color-bar { background: var(--container-purple); }
      .container.color-pink .container-color-bar { background: var(--container-pink); }
      .container-content { padding: 12px; min-height: 100px; }
      .resize-handle {
        position: absolute; background: var(--accent); opacity: 0;
        transition: opacity var(--transition-fast); z-index: 10;
      }
      .canvas-item.selected .resize-handle { opacity: 1; }
      .resize-handle:hover { opacity: 1 !important; }
      .resize-handle.corner { width: 10px; height: 10px; border-radius: 2px; }
      .resize-handle.edge { border-radius: 2px; }
      .resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
      .resize-handle.e { right: -4px; top: 50%; transform: translateY(-50%); width: 8px; height: 30px; cursor: e-resize; }
      .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); width: 30px; height: 8px; cursor: s-resize; }
      .hidden { display: none !important; }
    `;
  }

  /**
   * Load and execute the app.js script
   */
  async function loadAppScript() {
    try {
      const scriptUrl = chrome.runtime.getURL('canvas/app.js');
      const response = await fetch(scriptUrl);
      const scriptText = await response.text();
      
      // Execute the script in the context of the page
      const scriptFn = new Function(scriptText + '\n return CanvasApp;');
      return scriptFn();
    } catch (err) {
      console.error('[SpawnCanvas] Could not load app.js:', err);
      return null;
    }
  }

  /**
   * Creates the host element and attaches Shadow DOM
   */
  async function createOverlay() {
    if (hostElement) return;

    // Create host element
    hostElement = document.createElement('div');
    hostElement.id = HOST_ID;
    
    // Style the host element to be a fixed overlay
    hostElement.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      display: none !important;
    `;

    // Attach Shadow DOM (open for debugging, can change to 'closed' for production)
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    // Load and inject styles
    const cssText = await loadStyles();
    const styleElement = document.createElement('style');
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);

    // Load and initialize the app
    const AppClass = await loadAppScript();
    if (AppClass) {
      canvasApp = new AppClass(shadowRoot);
      canvasApp.init();
      
      // Listen for close event from the app
      shadowRoot.addEventListener('spawn-canvas-close', () => {
        hideOverlay();
      });
    } else {
      // Fallback: create basic structure if app.js fails
      createFallbackApp();
    }

    // Append to document body
    document.body.appendChild(hostElement);
    isInitialized = true;
    
    console.log('[SpawnCanvas] Overlay created');
  }

  /**
   * Create a basic fallback app structure if app.js fails to load
   */
  function createFallbackApp() {
    const wrapper = document.createElement('div');
    wrapper.className = 'spawn-canvas-wrapper';
    wrapper.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <span style="color: var(--text-secondary)">SpawnCanvas</span>
        </div>
        <div class="toolbar-right">
          <button class="close-btn icon-btn" title="Close">&times;</button>
        </div>
      </div>
      <div class="canvas-area">
        <div class="canvas-surface">
          <div class="center-anchor"></div>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                      color: var(--text-secondary); text-align: center;">
            <p>Failed to load SpawnCanvas app.</p>
            <p>Please reload the extension.</p>
          </div>
        </div>
      </div>
    `;
    
    wrapper.querySelector('.close-btn').addEventListener('click', hideOverlay);
    shadowRoot.appendChild(wrapper);
  }

  /**
   * Shows the overlay
   */
  async function showOverlay() {
    if (!isInitialized) {
      await createOverlay();
    }
    
    if (hostElement) {
      hostElement.style.display = 'block';
      isVisible = true;
      
      // Focus the canvas for keyboard events
      const wrapper = shadowRoot.querySelector('.spawn-canvas-wrapper');
      if (wrapper) {
        wrapper.focus();
      }
    }
  }

  /**
   * Hides the overlay
   */
  function hideOverlay() {
    if (hostElement) {
      hostElement.style.display = 'none';
    }
    isVisible = false;
  }

  /**
   * Toggles the overlay visibility
   */
  async function toggleOverlay() {
    if (isVisible) {
      hideOverlay();
    } else {
      await showOverlay();
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TOGGLE_OVERLAY') {
      toggleOverlay().then(() => {
        sendResponse({ success: true, visible: isVisible });
      });
      return true; // Keep channel open for async response
    }
    return false;
  });

  // Pre-initialize overlay (hidden) after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Delay initialization slightly to not block page load
      setTimeout(createOverlay, 100);
    });
  } else {
    setTimeout(createOverlay, 100);
  }

})();
