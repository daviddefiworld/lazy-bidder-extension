import {
  LB_CHANNEL,
  type FromContentMessage,
  isFromContentMessage,
  type ToContentMessage
} from '../types/messages';

type PendingEntry = {
  resolve: (result: unknown) => void;
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

const MAIN_FRAME: chrome.tabs.MessageSendOptions = { frameId: 0 };

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
    if (message.result === undefined) {
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

  dispatch<T = unknown>(
    tabId: number,
    action: string,
    payload: unknown,
    timeoutMs = 600_000
  ): Promise<T> {
    this.ensureListener();
    const actionId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectPending(actionId, new Error('Action timed out'));
      }, timeoutMs);

      this.pending.set(actionId, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer
      });

      const msg: ToContentMessage = {
        channel: LB_CHANNEL,
        type: 'dispatch',
        actionId,
        tabId,
        action,
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
