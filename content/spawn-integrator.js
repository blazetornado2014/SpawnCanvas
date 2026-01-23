/**
 * Spawn Integrator
 * Content script for spawn.co/play/* pages
 * Auto-captures prompts and responses for the Memory Tab
 */

(function () {
  'use strict';

  // Only run on spawn.co/play/* pages
  if (!window.location.hostname.includes('spawn.co') ||
      !window.location.pathname.startsWith('/play/')) {
    return;
  }

  console.log('[SpawnCanvas] Spawn integrator loaded on:', window.location.pathname);

  // Extract project ID from URL path (e.g., /play/super-game-123 -> super-game-123)
  function getProjectId() {
    const match = window.location.pathname.match(/\/play\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  // State
  let currentProjectId = getProjectId();
  let pendingPrompt = null;
  let pendingPromptTimestamp = null;
  let responseDebounceTimer = null;
  let lastObservedResponse = '';

  // Response debounce delay (for streaming responses)
  const RESPONSE_DEBOUNCE_MS = 2000;

  /**
   * Send captured memory to background script
   */
  function saveMemory(message) {
    if (!currentProjectId) {
      console.warn('[SpawnCanvas] No project ID found');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'SAVE_MEMORY',
      projectId: currentProjectId,
      message: message
    }).then(() => {
      console.log('[SpawnCanvas] Memory saved for project:', currentProjectId);
    }).catch(err => {
      console.error('[SpawnCanvas] Failed to save memory:', err);
    });
  }

  /**
   * Capture user prompt from textarea
   */
  function capturePrompt(text) {
    if (!text || !text.trim()) return;

    pendingPrompt = text.trim();
    pendingPromptTimestamp = Date.now();
    lastObservedResponse = '';

    console.log('[SpawnCanvas] Prompt captured:', pendingPrompt.substring(0, 50) + '...');
  }

  /**
   * Capture AI response (debounced for streaming)
   */
  function captureResponse(text) {
    if (!text || !text.trim() || !pendingPrompt) return;

    const responseText = text.trim();

    // Only process if response has changed
    if (responseText === lastObservedResponse) return;
    lastObservedResponse = responseText;

    // Clear existing debounce timer
    if (responseDebounceTimer) {
      clearTimeout(responseDebounceTimer);
    }

    // Debounce to wait for streaming to complete
    responseDebounceTimer = setTimeout(() => {
      const message = {
        prompt: pendingPrompt,
        promptTimestamp: pendingPromptTimestamp,
        response: responseText,
        responseTimestamp: Date.now()
      };

      saveMemory(message);

      // Reset pending state
      pendingPrompt = null;
      pendingPromptTimestamp = null;
      responseDebounceTimer = null;
    }, RESPONSE_DEBOUNCE_MS);
  }

  /**
   * Find the prompt input textarea
   * Note: Selector may need adjustment based on spawn.co DOM structure
   */
  function findPromptInput() {
    // Try multiple selectors
    const selectors = [
      'textarea[aria-label="What do you want to play?"]',
      'textarea[placeholder*="want"]',
      'textarea[data-testid="prompt-input"]',
      '.prompt-input textarea',
      'main textarea',
      'textarea'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Find the chat/response container
   * Note: Selector may need adjustment based on spawn.co DOM structure
   */
  function findChatContainer() {
    // Try multiple selectors for chat/response area
    const selectors = [
      '[data-testid="chat-container"]',
      '[data-testid="response-container"]',
      '.chat-messages',
      '.response-area',
      'main [role="log"]',
      'main .messages'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Get the latest AI response text from the chat container
   */
  function getLatestResponse(container) {
    // Try to find the latest AI message
    // This is highly dependent on spawn.co's DOM structure
    const responseSelectors = [
      '[data-role="assistant"]:last-child',
      '.ai-message:last-child',
      '.assistant-message:last-child',
      '[data-testid="ai-response"]:last-child'
    ];

    for (const selector of responseSelectors) {
      const element = container.querySelector(selector);
      if (element) {
        return element.textContent || element.innerText;
      }
    }

    // Fallback: try to get all text after user message markers
    // This is a best-effort approach
    const allMessages = container.querySelectorAll('[data-role], .message');
    if (allMessages.length > 0) {
      const lastMessage = allMessages[allMessages.length - 1];
      const role = lastMessage.dataset?.role || lastMessage.className;
      if (role && (role.includes('assistant') || role.includes('ai'))) {
        return lastMessage.textContent || lastMessage.innerText;
      }
    }

    return null;
  }

  /**
   * Set up input listener
   */
  function setupInputListener() {
    const textarea = findPromptInput();
    if (!textarea) {
      console.log('[SpawnCanvas] Prompt input not found, will retry...');
      return false;
    }

    // Listen for Enter key (submit)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Small delay to ensure textarea value is captured before clear
        setTimeout(() => {
          const text = textarea.value;
          if (text && text.trim()) {
            capturePrompt(text);
          }
        }, 0);
      }
    });

    // Also listen for potential submit button clicks
    const form = textarea.closest('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        const text = textarea.value;
        if (text && text.trim()) {
          capturePrompt(text);
        }
      });
    }

    console.log('[SpawnCanvas] Input listener attached');
    return true;
  }

  /**
   * Set up mutation observer for responses
   */
  function setupResponseObserver() {
    const chatContainer = findChatContainer();

    // If no specific container found, observe the whole main area
    const targetNode = chatContainer || document.querySelector('main') || document.body;

    const observer = new MutationObserver((mutations) => {
      // Only process if we have a pending prompt
      if (!pendingPrompt) return;

      // Look for response text changes
      const container = findChatContainer() || targetNode;
      const responseText = getLatestResponse(container);

      if (responseText) {
        captureResponse(responseText);
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[SpawnCanvas] Response observer attached');
    return observer;
  }

  /**
   * Initialize integrator
   */
  function init() {
    // Retry setup if elements aren't immediately available
    let retryCount = 0;
    const maxRetries = 10;

    const trySetup = () => {
      if (setupInputListener()) {
        setupResponseObserver();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(trySetup, 1000);
      } else {
        console.warn('[SpawnCanvas] Could not find spawn.co interface elements');
      }
    };

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trySetup);
    } else {
      // Small delay to let dynamic content load
      setTimeout(trySetup, 500);
    }

    // Listen for URL changes (SPA navigation)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        currentProjectId = getProjectId();
        console.log('[SpawnCanvas] Project changed to:', currentProjectId);

        // Reset state
        pendingPrompt = null;
        pendingPromptTimestamp = null;
        lastObservedResponse = '';

        // Re-setup if on a play page
        if (currentProjectId) {
          setTimeout(trySetup, 500);
        }
      }
    });

    urlObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Start
  init();

})();
