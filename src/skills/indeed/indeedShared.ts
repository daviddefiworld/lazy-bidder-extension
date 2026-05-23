import { LB_CHANNEL } from '../../types/messages';
import type { IndeedOrderParams, InjectIndeedPageHookMessage, InjectIndeedPageHookResponse } from './types';

export const INDEED_ACTION = 'processIndeedPage' as const;
export const INDEED_PAGE_HOOK = 'indeed/pageHook.js';

export function buildIndeedSearchUrl(
  params: Pick<IndeedOrderParams, 'query' | 'location' | 'sort' | 'fromage'>,
  start: number
): string {
  const q = new URLSearchParams({
    q: params.query,
    l: params.location,
    sort: params.sort,
    fromage: params.fromage,
    start: String(start)
  });
  return `https://www.indeed.com/jobs?${q.toString()}`;
}

export function isInjectIndeedPageHookMessage(msg: unknown): msg is InjectIndeedPageHookMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg as InjectIndeedPageHookMessage).channel === LB_CHANNEL &&
    (msg as InjectIndeedPageHookMessage).type === 'injectIndeedPageHook' &&
    typeof (msg as InjectIndeedPageHookMessage).tabId === 'number'
  );
}

export function handleIndeedBackgroundMessage(
  message: InjectIndeedPageHookMessage,
  sendResponse: (response: InjectIndeedPageHookResponse) => void
): void {
  chrome.scripting
    .executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      files: [INDEED_PAGE_HOOK]
    })
    .then(() => sendResponse({ ok: true }))
    .catch((err: unknown) => {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    });
}
