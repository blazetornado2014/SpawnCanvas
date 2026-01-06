chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_OVERLAY" }).catch((err) => {
    // If we can't send a message, it might be that the content script hasn't loaded 
    // or we are on a restricted page (like chrome://).
    console.log("Could not send toggle message:", err);
  });
});
