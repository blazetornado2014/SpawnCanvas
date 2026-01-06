/**
 * Bridge Module
 * Handles communication between the page context, content script, and background service worker.
 * Future-proofing for potential features like:
 * - Cross-tab sync
 * - External integrations
 * - Page content clipping
 */

(function () {
  'use strict';

  const Bridge = {
    /**
     * Send a message to the background service worker
     * @param {string} action - The action type
     * @param {object} data - Additional data to send
     * @returns {Promise<any>} Response from the background script
     */
    async sendToBackground(action, data = {}) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    },

    /**
     * Listen for messages from the background service worker
     * @param {function} callback - Handler function (message, sender) => response
     */
    onBackgroundMessage(callback) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const result = callback(message, sender);
        if (result instanceof Promise) {
          result.then(sendResponse).catch((err) => {
            sendResponse({ error: err.message });
          });
          return true; // Keep channel open for async response
        }
        if (result !== undefined) {
          sendResponse(result);
        }
        return false;
      });
    },

    /**
     * Post a message to the canvas app (within Shadow DOM)
     * @param {ShadowRoot} shadowRoot - The shadow root containing the app
     * @param {string} type - Message type
     * @param {object} data - Message data
     */
    postToCanvas(shadowRoot, type, data = {}) {
      const event = new CustomEvent('spawn-canvas-message', {
        detail: { type, data },
        bubbles: false,
        composed: false
      });
      shadowRoot.dispatchEvent(event);
    },

    /**
     * Listen for messages from the canvas app
     * @param {ShadowRoot} shadowRoot - The shadow root containing the app
     * @param {function} callback - Handler function (type, data) => void
     */
    onCanvasMessage(shadowRoot, callback) {
      shadowRoot.addEventListener('spawn-canvas-message', (event) => {
        const { type, data } = event.detail;
        callback(type, data);
      });
    },

    /**
     * Get the current tab's URL
     * @returns {string} Current page URL
     */
    getCurrentUrl() {
      return window.location.href;
    },

    /**
     * Get the current tab's title
     * @returns {string} Current page title
     */
    getCurrentTitle() {
      return document.title;
    },

    /**
     * Check if we're on a restricted page (chrome://, about:, etc.)
     * @returns {boolean} True if on a restricted page
     */
    isRestrictedPage() {
      const protocol = window.location.protocol;
      return ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'brave:'].includes(protocol);
    }
  };

  // Export for use in other modules
  window.SpawnCanvasBridge = Bridge;

})();
