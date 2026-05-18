import {
  LB_CHANNEL,
  type ContentAction,
  type FromContentMessage,
  isFromContentMessage,
  type ProcessIndeedPagePayload,
  type ProcessIndeedPageResult,
  type ToContentMessage
} from '../types/messages';

type PendingEntry = {
  resolve: (result: ProcessIndeedPageResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type ActionProgressHandler = (data: {
  orderId: string;
  jobsFound: number;
  jobsScraped: number;
}) => void;

export type ActionJobResultHandler = (data: {
  orderId: string;
  jobId: string;
  jobDetail: unknown;
}) => void;

/** Top-level document only — avoids flaky pings from embedded Indeed iframes. */
const MAIN_FRAME: chrome.tabs.MessageSendOptions = { frameId: 0 };

/**
 * Sidebar-side coordinator: dispatch actions to content without holding the message port open.
 * Content reports completion via runtime messages with actionId.
 */
class ActionCoordinator {
  private pending = new Map<string, PendingEntry>();
  private progressHandler: ActionProgressHandler | null = null;
  private jobResultHandler: ActionJobResultHandler | null = null;
  private listenerInstalled = false;

  setProgressHandler(handler: ActionProgressHandler | null): void {
    this.progressHandler = handler;
  }

  setJobResultHandler(handler: ActionJobResultHandler | null): void {
    this.jobResultHandler = handler;
  }

  ensureListener(): void {
    if (this.listenerInstalled) return;
    this.listenerInstalled = true;

    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isFromContentMessage(message)) return;

      if (message.type === 'actionProgress') {
        this.progressHandler?.(message.data);
        return;
      }

      if (message.type === 'actionJobResult') {
        this.jobResultHandler?.(message.data);
        return;
      }

      if (message.type === 'actionDone') {
        this.handleActionDone(message);
      }
    });
  }

  private handleActionDone(message: Extract<FromContentMessage, { type: 'actionDone' }>): void {
    const entry = this.pending.get(message.actionId);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(message.actionId);

    if (!message.success) {
      entry.reject(new Error(message.error ?? 'Action failed'));
      return;
    }
    if (!message.result) {
      entry.reject(new Error('Action completed without result'));
      return;
    }
    entry.resolve(message.result);
  }

  private rejectPending(actionId: string, error: Error): void {
    const entry = this.pending.get(actionId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(actionId);
    entry.reject(error);
  }

  /** Sync ping — short-lived port is fine. */
  pingTab(tabId: number): Promise<boolean> {
    const msg: ToContentMessage = { channel: LB_CHANNEL, type: 'ping' };
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, msg, MAIN_FRAME, (response: unknown) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(
          !!response &&
            typeof response === 'object' &&
            (response as FromContentMessage).channel === LB_CHANNEL &&
            (response as FromContentMessage).type === 'pong'
        );
      });
    });
  }

  async waitForTabReady(tabId: number, attempts = 40, intervalMs = 500): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      if (await this.pingTab(tabId)) return;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    throw new Error('Content script not available on tab');
  }

  /** Fire-and-forget dispatch; resolves when content sends actionDone. */
  dispatchProcessIndeedPage(
    tabId: number,
    payload: ProcessIndeedPagePayload,
    timeoutMs = 600_000
  ): Promise<ProcessIndeedPageResult> {
    this.ensureListener();
    const actionId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectPending(actionId, new Error('Action timed out'));
      }, timeoutMs);

      this.pending.set(actionId, {
        resolve,
        reject,
        timer
      });

      const msg: ToContentMessage = {
        channel: LB_CHANNEL,
        type: 'dispatch',
        actionId,
        tabId,
        action: 'processIndeedPage' as ContentAction,
        payload
      };

      chrome.tabs.sendMessage(tabId, msg, MAIN_FRAME, () => {
        if (chrome.runtime.lastError) {
          this.rejectPending(
            actionId,
            new Error(chrome.runtime.lastError?.message ?? 'Failed to dispatch action')
          );
        }
      });
    });
  }

  cancelAll(reason = 'Cancelled'): void {
    for (const [actionId] of this.pending) {
      this.rejectPending(actionId, new Error(reason));
    }
  }
}

export const actionCoordinator = new ActionCoordinator();
