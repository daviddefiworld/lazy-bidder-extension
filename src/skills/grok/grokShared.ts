import { LB_CHANNEL } from '../../types/messages';
import type { InjectGrokPageHookMessage, InjectGrokPageHookResponse } from './types';

export const GROK_ACTION = 'runGrokChat' as const;
export const GROK_PAGE_HOOK = 'grok/pageHook.js';

export function isInjectGrokPageHookMessage(msg: unknown): msg is InjectGrokPageHookMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg as InjectGrokPageHookMessage).channel === LB_CHANNEL &&
    (msg as InjectGrokPageHookMessage).type === 'injectGrokPageHook' &&
    typeof (msg as InjectGrokPageHookMessage).tabId === 'number'
  );
}

export function handleGrokBackgroundMessage(
  message: InjectGrokPageHookMessage,
  sendResponse: (response: InjectGrokPageHookResponse) => void
): void {
  chrome.scripting
    .executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      files: [GROK_PAGE_HOOK]
    })
    .then(() => sendResponse({ ok: true }))
    .catch((err: unknown) => {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    });
}
