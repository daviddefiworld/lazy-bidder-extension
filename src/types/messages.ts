/** Shared LazyBidder extension messaging (sidebar ↔ content). */

export const LB_CHANNEL = 'lazybidder' as const;

export type ContentAction = 'processIndeedPage';

export interface ProcessIndeedPagePayload {
  params: {
    orderId: string;
    query: string;
    location: string;
    sort: string;
    fromage: string;
  };
  totals: { jobsFound: number; jobsScraped: number };
  resumeAfterJobId?: string;
}

export interface ProcessIndeedPageResult {
  hasNext: boolean;
  totals: { jobsFound: number; jobsScraped: number };
}

export type ToContentMessage =
  | { channel: typeof LB_CHANNEL; type: 'ping' }
  | {
      channel: typeof LB_CHANNEL;
      type: 'dispatch';
      actionId: string;
      /** Required for MAIN-world injection; `sender.tab` is unset when the sender is the side panel. */
      tabId: number;
      action: ContentAction;
      payload: ProcessIndeedPagePayload;
    };

export type FromContentMessage =
  | { channel: typeof LB_CHANNEL; type: 'pong' }
  | { channel: typeof LB_CHANNEL; type: 'dispatchAck' }
  | {
      channel: typeof LB_CHANNEL;
      type: 'actionProgress';
      actionId: string;
      data: { orderId: string; jobsFound: number; jobsScraped: number };
    }
  | {
      channel: typeof LB_CHANNEL;
      type: 'actionJobResult';
      actionId: string;
      data: { orderId: string; jobId: string; jobDetail: unknown };
    }
  | {
      channel: typeof LB_CHANNEL;
      type: 'actionDone';
      actionId: string;
      success: boolean;
      result?: ProcessIndeedPageResult;
      error?: string;
    };

export function isFromContentMessage(msg: unknown): msg is FromContentMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg as FromContentMessage).channel === LB_CHANNEL &&
    typeof (msg as FromContentMessage).type === 'string'
  );
}

export function isToContentMessage(msg: unknown): msg is ToContentMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg as ToContentMessage).channel === LB_CHANNEL &&
    typeof (msg as ToContentMessage).type === 'string'
  );
}

/** Content → background (`chrome.scripting` is only available in the service worker). */
export type InjectIndeedPageHookMessage = {
  channel: typeof LB_CHANNEL;
  type: 'injectIndeedPageHook';
  tabId: number;
};

export type InjectIndeedPageHookResponse = { ok: true } | { ok: false; error: string };

export function isInjectIndeedPageHookMessage(msg: unknown): msg is InjectIndeedPageHookMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg as InjectIndeedPageHookMessage).channel === LB_CHANNEL &&
    (msg as InjectIndeedPageHookMessage).type === 'injectIndeedPageHook' &&
    typeof (msg as InjectIndeedPageHookMessage).tabId === 'number'
  );
}
