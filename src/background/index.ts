const tabUrls = new Map<number, string>();

const getExtensionId = async (): Promise<string> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['extensionInstanceId'], (result) => {
      if (result.extensionInstanceId) {
        resolve(result.extensionInstanceId);
      } else {
        const id = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        chrome.storage.local.set({ extensionInstanceId: id }, () => resolve(id));
      }
    });
  });
};

chrome.runtime.onInstalled.addListener(async () => {
  await getExtensionId();
  chrome.storage.sync.set({ isActive: false });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;
  
  if (action === 'getState') {
    chrome.storage.sync.get(['isActive'], (result) => {
      sendResponse({ isActive: result.isActive || false });
    });
    return true;
  }
  
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
  
  if (action === 'getExtensionId') {
    getExtensionId().then(extensionId => sendResponse({ extensionId }));
    return true;
  }
  
  if (action === 'activation_command') {
    chrome.storage.sync.set({ isActive: message.isActive }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'activation_command', 
              isActive: message.isActive 
            }).catch(() => {});
          }
        });
      });
      sendResponse({ success: true, isActive: message.isActive });
    });
    return true;
  }
});

const sendUrlChange = async (tabId: number, url: string, title?: string) => {
  const extensionId = await getExtensionId();
  chrome.runtime.sendMessage({
    action: 'urlChange',
    data: {
      url,
      previousUrl: tabUrls.get(tabId) || '',
      tabId,
      timestamp: Date.now(),
      extensionId,
      title,
      type: 'tab_change'
    }
  });
  tabUrls.set(tabId, url);
};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url) {
    await sendUrlChange(tabId, changeInfo.url, tab.title);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) {
    await sendUrlChange(tabId, tab.url, tab.title);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabUrls.delete(tabId));
