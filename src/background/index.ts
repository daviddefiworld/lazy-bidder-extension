// Background script - minimal: only handles essential Chrome APIs

chrome.runtime.onInstalled.addListener(() => {
  // isRunning is now stored in DB, no need for chrome.storage
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;
  
  // Handle ping from content script
  if (action === 'ping') {
    console.log('Background script received ping from content script');
    sendResponse({ success: true, message: 'Background script is available' });
    return true;
  }
  
  // Handle URL navigation requests from sidebar
  if (action === 'changeUrl') {
    if (message.tabId && message.url) {
      chrome.tabs.update(message.tabId, { url: message.url }, (tab) => {
        sendResponse(chrome.runtime.lastError 
          ? { success: false, error: chrome.runtime.lastError.message }
          : { success: true, tab });
      });
    } else {
      sendResponse({ success: false, error: 'Missing tabId or url' });
    }
    return true;
  }
  
  // Forward URL changes from content script to sidebar
  if (action === 'sendUrlChange') {
    chrome.runtime.sendMessage({
      action: 'urlChange',
      data: message.data
    }).catch(() => {});
    return false;
  }
});

// Track URL changes and forward to sidebar
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url) {
    chrome.runtime.sendMessage({
      action: 'urlChange',
      data: {
        url: changeInfo.url,
        tabId,
        timestamp: Date.now(),
        title: tab.title,
        type: 'tab_change'
      }
    }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) {
    chrome.runtime.sendMessage({
      action: 'urlChange',
      data: {
        url: tab.url,
        tabId,
        timestamp: Date.now(),
        title: tab.title,
        type: 'tab_change'
      }
    }).catch(() => {});
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
