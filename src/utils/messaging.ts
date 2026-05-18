import { actionCoordinator } from './actionCoordinator';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeIndeedUrl(url: string): string {
  return url.split('#')[0];
}

export function indeedUrlMatches(tabUrl: string | undefined, expected: string): boolean {
  const tab = normalizeIndeedUrl(tabUrl ?? '');
  const exp = normalizeIndeedUrl(expected);
  return tab === exp || tab.startsWith(exp);
}

/** @deprecated Use actionCoordinator — fire-and-forget only. */
export function safeRuntimeSend(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

/** Ping content script (sync response, safe for short checks). */
export function pingContentScript(tabId: number, attempts = 1): Promise<boolean> {
  return (async () => {
    for (let i = 0; i < attempts; i++) {
      if (await actionCoordinator.pingTab(tabId)) {
        return true;
      }
      if (i < attempts - 1) {
        await sleep(400);
      }
    }
    return false;
  })();
}

export function isMessagingDeadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('message port closed') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('asynchronous response')
  );
}

/** Wait until Indeed SERP URL is loaded and content script answers ping. */
export async function waitForIndeedTab(
  tabId: number,
  expectedUrl: string,
  timeoutMs = 60_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && indeedUrlMatches(tab.url, expectedUrl)) {
      if (await actionCoordinator.pingTab(tabId)) {
        await sleep(300);
        if (await actionCoordinator.pingTab(tabId)) {
          return;
        }
      }
    }
    await sleep(500);
  }

  throw new Error('Indeed page did not become ready');
}
