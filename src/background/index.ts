// Background script — tab navigation for Indeed orders

import { isInjectIndeedPageHookMessage } from '../types/messages';

chrome.runtime.onInstalled.addListener(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isInjectIndeedPageHookMessage(message)) {
    chrome.scripting
      .executeScript({
        target: { tabId: message.tabId },
        world: 'MAIN',
        files: ['indeedPageHook.js']
      })
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        });
      });
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
