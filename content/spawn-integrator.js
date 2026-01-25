/**
 * Spawn Integrator
 * Content script for spawn.co pages
 * Auto-captures prompts and responses for the Memory Tab
 *
 * Simple approach:
 * 1. Listen for Enter key at document level
 * 2. Capture text from focused input/textarea
 * 3. Wait for DOM changes and capture the response
 */

console.log('%c[SpawnCanvas] Spawn Integrator Loaded', 'background: #4A9EFF; color: white; padding: 4px 8px;');

(function () {
  'use strict';

  // Only run on spawn.co
  if (!window.location.hostname.includes('spawn.co')) {
    return;
  }

  // State
  let pendingPrompt = null;
  let pendingPromptTimestamp = null;
  let responseDebounceTimer = null;
  let lastResponseText = '';

  const RESPONSE_DEBOUNCE_MS = 2000;

  /**
   * Get project ID from URL
   */
  function getProjectId() {
    const parts = window.location.pathname.split('/').filter(p => p);
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('/');
    }
    return parts[0] || null;
  }

  /**
   * Check if we're on a project page (not home)
   */
  function isProjectPage() {
    const parts = window.location.pathname.split('/').filter(p => p);
    return parts.length >= 2;
  }

  /**
   * Save memory to background script
   */
  function saveMemory(projectId, message) {
    chrome.runtime.sendMessage({
      action: 'SAVE_MEMORY',
      projectId,
      message
    }).then(() => {
      console.log('[SpawnCanvas] Memory saved:', projectId);
    }).catch(err => {
      console.error('[SpawnCanvas] Save failed:', err);
    });
  }

  /**
   * Find the latest AI response in the page
   */
  function findLatestResponse() {
    // Look for common response container patterns
    const selectors = [
      '[data-role="assistant"]',
      '[data-sender="assistant"]',
      '[class*="assistant"]',
      '[class*="ai-message"]',
      '[class*="bot-message"]',
      '[class*="response"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const last = elements[elements.length - 1];
        const text = last.textContent?.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    // Fallback: look for message containers
    const messageContainers = document.querySelectorAll('[class*="message"]');
    if (messageContainers.length > 0) {
      // Get the last few and find one that's not the user's
      for (let i = messageContainers.length - 1; i >= Math.max(0, messageContainers.length - 5); i--) {
        const el = messageContainers[i];
        const className = el.className?.toLowerCase() || '';
        if (!className.includes('user') && !className.includes('human')) {
          const text = el.textContent?.trim();
          if (text && text.length > 20) {
            return text;
          }
        }
      }
    }

    return null;
  }

  /**
   * Handle response detection (debounced)
   */
  function onResponseDetected() {
    if (!pendingPrompt) return;

    const responseText = findLatestResponse();
    if (!responseText || responseText === lastResponseText) return;

    lastResponseText = responseText;

    // Debounce to wait for streaming to complete
    if (responseDebounceTimer) {
      clearTimeout(responseDebounceTimer);
    }

    responseDebounceTimer = setTimeout(() => {
      const projectId = getProjectId();
      if (!projectId || !pendingPrompt) return;

      saveMemory(projectId, {
        prompt: pendingPrompt,
        promptTimestamp: pendingPromptTimestamp,
        response: responseText,
        responseTimestamp: Date.now()
      });

      // Reset
      pendingPrompt = null;
      pendingPromptTimestamp = null;
      responseDebounceTimer = null;
    }, RESPONSE_DEBOUNCE_MS);
  }

  /**
   * Listen for Enter key on any input/textarea
   */
  document.addEventListener('keydown', (e) => {
    // Only care about Enter without modifiers (Shift+Enter is newline)
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;

    // Only on project pages
    if (!isProjectPage()) return;

    // Check if focus is on an input element
    const active = document.activeElement;
    if (!active) return;

    const isInput = active.tagName === 'TEXTAREA' ||
                    active.tagName === 'INPUT' ||
                    active.isContentEditable;

    if (!isInput) return;

    // Capture the text before it gets cleared
    const text = active.value || active.textContent || '';
    if (!text.trim()) return;

    pendingPrompt = text.trim();
    pendingPromptTimestamp = Date.now();
    lastResponseText = '';

    console.log('[SpawnCanvas] Prompt captured:', pendingPrompt.substring(0, 50) + '...');
  }, true); // Use capture phase to get it before the app clears the input

  /**
   * Observe DOM for response changes
   */
  const observer = new MutationObserver(() => {
    if (pendingPrompt) {
      onResponseDetected();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('[SpawnCanvas] Listening for prompts on spawn.co');

})();
