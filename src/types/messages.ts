/** Shared LazyBidder extension messaging (sidebar ↔ content). */

export const LB_CHANNEL = 'lazybidder' as const;

export type ToContentMessage =
  | { channel: typeof LB_CHANNEL; type: 'ping' }
  | {
      channel: typeof LB_CHANNEL;
      type: 'dispatch';
      actionId: string;
      tabId: number;
      action: string;
      payload: unknown;
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
      result?: unknown;
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
