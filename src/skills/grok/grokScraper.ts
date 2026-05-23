import { LB_CHANNEL, type FromContentMessage } from '../../types/messages';
import { GROK_ACTION } from './grokShared';
import type {
  GrokChatPayload,
  GrokChatResult,
  GrokStreamChunk,
  InjectGrokPageHookMessage,
  InjectGrokPageHookResponse
} from './types';

export { GROK_ACTION };

const GROK_STREAM_MSG = { source: 'lazybidder', kind: 'grokChatStream' } as const;
const NEW_CHAT_SELECTOR = '[data-testid="new-chat"]';
const SUBMIT_SELECTOR = '[data-testid="chat-submit"]';
const PAGE_READY_TIMEOUT_MS = 60_000;
const CHAT_RESPONSE_TIMEOUT_MS = 300_000;
const STEP_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSelector(selector: string, timeoutMs = PAGE_READY_TIMEOUT_MS): Promise<Element> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(250);
  }
  throw new Error(`Element not found: ${selector}`);
}

function findChatEditor(): HTMLElement {
  const editor =
    document.querySelector('motion-div[contenteditable="true"]') ??
    document.querySelector('div[contenteditable="true"]');
  if (!editor || !(editor instanceof HTMLElement)) {
    throw new Error('Chat input (contenteditable) not found');
  }
  return editor;
}

async function installFetchHook(tabId: number): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    channel: LB_CHANNEL,
    type: 'injectGrokPageHook',
    tabId
  } satisfies InjectGrokPageHookMessage)) as InjectGrokPageHookResponse | undefined;
  if (!response?.ok) {
    throw new Error(
      response && 'error' in response ? response.error : 'Failed to inject Grok page hook'
    );
  }
}

function parseStreamBody(body: string): GrokStreamChunk[] {
  const events: GrokStreamChunk[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          events.push(JSON.parse(body.slice(start, i + 1)) as GrokStreamChunk);
        } catch {
          /* skip malformed chunk */
        }
        start = -1;
      }
    }
  }

  return events;
}

function extractChatResult(events: GrokStreamChunk[]): GrokChatResult {
  let conversationId: string | undefined;
  let message: string | null = null;
  let tokenBuffer = '';
  let sawSoftStop = false;

  for (const event of events) {
    const convId = event.result?.conversation?.conversationId;
    if (convId) conversationId = convId;

    const response = event.result?.response;
    if (!response) continue;

    const model = response.modelResponse;
    if (model?.sender === 'ASSISTANT' && model.message) {
      message = model.message;
    }

    if (response.token && response.messageTag === 'final' && !response.isThinking) {
      tokenBuffer += response.token;
    }
    if (response.isSoftStop) {
      sawSoftStop = true;
    }
  }

  if (!message && sawSoftStop && tokenBuffer.trim()) {
    message = tokenBuffer.trim();
  }

  if (!message) {
    throw new Error('Grok response did not include assistant message');
  }

  return { message, conversationId };
}

function waitForGrokStream(timeoutMs = CHAT_RESPONSE_TIMEOUT_MS): Promise<GrokChatResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Grok chat response timeout'));
    }, timeoutMs);

    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (
        !d ||
        typeof d !== 'object' ||
        d.source !== GROK_STREAM_MSG.source ||
        d.kind !== GROK_STREAM_MSG.kind ||
        typeof d.body !== 'string'
      ) {
        return;
      }

      clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      try {
        const events = parseStreamBody(d.body);
        resolve(extractChatResult(events));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    window.addEventListener('message', onMessage);
  });
}

async function clickNewChat(): Promise<void> {
  const el = await waitForSelector(NEW_CHAT_SELECTOR);
  if (!(el instanceof HTMLElement)) {
    throw new Error('New chat control is not clickable');
  }
  el.click();
  await sleep(STEP_DELAY_MS);
}

function setPromptText(editor: HTMLElement, text: string): void {
  editor.focus();

  let paragraph = editor.querySelector('p');
  if (!paragraph) {
    paragraph = document.createElement('p');
    editor.appendChild(paragraph);
  }
  paragraph.textContent = text;

  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

async function submitPrompt(): Promise<void> {
  const btn = await waitForSelector(SUBMIT_SELECTOR);
  if (!(btn instanceof HTMLElement)) {
    throw new Error('Submit button is not clickable');
  }
  btn.click();
}

async function runChat(tabId: number, prompt: string): Promise<GrokChatResult> {
  await installFetchHook(tabId);
  await waitForSelector(NEW_CHAT_SELECTOR);

  const streamPromise = waitForGrokStream();

  await clickNewChat();
  setPromptText(findChatEditor(), prompt);
  await sleep(STEP_DELAY_MS);
  await submitPrompt();

  return streamPromise;
}

function notifySidebar(message: FromContentMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

export async function runGrokChatAction(
  actionId: string,
  payload: GrokChatPayload,
  tabId: number
): Promise<void> {
  const prompt = payload.prompt?.trim();
  if (!prompt) {
    notifySidebar({
      channel: LB_CHANNEL,
      type: 'actionDone',
      actionId,
      success: false,
      error: 'Prompt is empty'
    });
    return;
  }

  try {
    const result = await runChat(tabId, prompt);
    notifySidebar({
      channel: LB_CHANNEL,
      type: 'actionDone',
      actionId,
      success: true,
      result
    });
  } catch (error) {
    notifySidebar({
      channel: LB_CHANNEL,
      type: 'actionDone',
      actionId,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
