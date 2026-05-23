import {
  handleIndeedBackgroundMessage,
  isInjectIndeedPageHookMessage
} from '../skills/indeed/indeedShared';
import {
  handleGrokBackgroundMessage,
  isInjectGrokPageHookMessage
} from '../skills/grok/grokShared';

chrome.runtime.onInstalled.addListener(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isInjectIndeedPageHookMessage(message)) {
    handleIndeedBackgroundMessage(message, sendResponse);
    return true;
  }

  if (isInjectGrokPageHookMessage(message)) {
    handleGrokBackgroundMessage(message, sendResponse);
    return true;
  }

  if (message.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'changeUrl' && message.tabId && message.url) {
    chrome.tabs.update(message.tabId, { url: message.url }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, tab });
      }
    });
    return true;
  }

  sendResponse({ success: false, error: `Unknown action: ${message.action}` });
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
