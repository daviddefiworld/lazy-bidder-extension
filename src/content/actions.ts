import { INDEED_ACTION, runIndeedPageAction } from '../skills/indeed/indeedScraper';
import type { ProcessIndeedPagePayload } from '../skills/indeed/types';
import { GROK_ACTION, runGrokChatAction } from '../skills/grok/grokScraper';
import type { GrokChatPayload } from '../skills/grok/types';
import { LB_CHANNEL, type FromContentMessage, type ToContentMessage } from '../types/messages';

export function handleContentMessage(
  message: ToContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | void {
  if (message.type === 'ping') {
    sendResponse({ channel: LB_CHANNEL, type: 'pong' } satisfies FromContentMessage);
    return;
  }

  if (message.type === 'dispatch') {
    if (message.action === INDEED_ACTION) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        chrome.runtime
          .sendMessage({
            channel: LB_CHANNEL,
            type: 'actionDone',
            actionId: message.actionId,
            success: false,
            error: 'Missing tab id (cannot inject page-world hook)'
          } satisfies FromContentMessage)
          .catch(() => {});
      } else {
        void runIndeedPageAction(
          message.actionId,
          message.payload as ProcessIndeedPagePayload,
          tabId
        );
      }
    } else if (message.action === GROK_ACTION) {
      const grokTabId = message.tabId ?? sender.tab?.id;
      if (grokTabId == null) {
        chrome.runtime
          .sendMessage({
            channel: LB_CHANNEL,
            type: 'actionDone',
            actionId: message.actionId,
            success: false,
            error: 'Missing tab id (cannot inject page-world hook)'
          } satisfies FromContentMessage)
          .catch(() => {});
      } else {
        void runGrokChatAction(
          message.actionId,
          message.payload as GrokChatPayload,
          grokTabId
        );
      }
    }
    sendResponse({ channel: LB_CHANNEL, type: 'dispatchAck' } satisfies FromContentMessage);
    return;
  }
}
