import type { LB_CHANNEL } from '../../types/messages';

export type GrokChatPayload = {
  prompt: string;
};

export type GrokChatResult = {
  message: string;
  conversationId?: string;
};

export type GrokStreamChunk = {
  result?: {
    conversation?: { conversationId?: string };
    response?: {
      token?: string;
      messageTag?: string;
      isThinking?: boolean;
      isSoftStop?: boolean;
      modelResponse?: {
        message?: string;
        sender?: string;
      };
    };
  };
};

export type InjectGrokPageHookMessage = {
  channel: typeof LB_CHANNEL;
  type: 'injectGrokPageHook';
  tabId: number;
};

export type InjectGrokPageHookResponse = { ok: true } | { ok: false; error: string };
