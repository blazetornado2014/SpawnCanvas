// Storage key for memories (must match store.js)
const MEMORIES_KEY = 'spawncanvas_memories';

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_OVERLAY" }).catch((err) => {
    // If we can't send a message, it might be that the content script hasn't loaded
    // or we are on a restricted page (like chrome://).
    console.log("Could not send toggle message:", err);
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SAVE_MEMORY') {
    saveMemory(message.projectId, message.message)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('[SpawnCanvas] Error saving memory:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }
});

/**
 * Save a memory message to storage
 * @param {string} projectId - Project ID from URL slug
 * @param {object} message - Message object with prompt, response, timestamps
 */
async function saveMemory(projectId, message) {
  try {
    // Get existing memories
    const result = await chrome.storage.local.get(MEMORIES_KEY);
    const memories = result[MEMORIES_KEY] || { projects: {} };

    // Create project entry if it doesn't exist
    if (!memories.projects[projectId]) {
      memories.projects[projectId] = {
        id: projectId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // Add message with unique ID
    const messageWithId = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...message
    };

    memories.projects[projectId].messages.push(messageWithId);
    memories.projects[projectId].updatedAt = Date.now();

    // Save back to storage
    await chrome.storage.local.set({ [MEMORIES_KEY]: memories });

    console.log('[SpawnCanvas] Memory saved for project:', projectId);
    return true;
  } catch (err) {
    console.error('[SpawnCanvas] Failed to save memory:', err);
    throw err;
  }
}
