import { processCurrentPage } from '../skills/indeed/indeedSkill';
import type { IndeedOrderParams } from '../skills/indeed/types';
import {
  LB_CHANNEL,
  type FromContentMessage,
  type ProcessIndeedPagePayload,
  type ToContentMessage
} from '../types/messages';

function notifySidebar(message: FromContentMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Sidebar closed — expected during teardown.
  });
}

export async function runProcessIndeedPage(
  actionId: string,
  payload: ProcessIndeedPagePayload,
  tabId: number
): Promise<void> {
  const params = payload.params as IndeedOrderParams;
  const totals = { ...payload.totals };

  try {
    const pageResult = await processCurrentPage(
      tabId,
      params,
      {
        onProgress: (p) => {
          notifySidebar({
            channel: LB_CHANNEL,
            type: 'actionProgress',
            actionId,
            data: p
          });
        },
        onJobResult: (r) => {
          notifySidebar({
            channel: LB_CHANNEL,
            type: 'actionJobResult',
            actionId,
            data: r
          });
        }
      },
      totals,
      { resumeAfterJobId: payload.resumeAfterJobId }
    );

    notifySidebar({
      channel: LB_CHANNEL,
      type: 'actionDone',
      actionId,
      success: true,
      result: {
        hasNext: pageResult.hasNext,
        totals: { jobsFound: totals.jobsFound, jobsScraped: totals.jobsScraped }
      }
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
    if (message.action === 'processIndeedPage') {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        console.error('LazyBidder: dispatch missing tabId on message and sender.tab');
        chrome.runtime
          .sendMessage({
            channel: LB_CHANNEL,
            type: 'actionDone',
            actionId: message.actionId,
            success: false,
            error: 'Missing tab id (cannot inject page-world hook)'
          } satisfies FromContentMessage)
          .catch(() => {});
        sendResponse({ channel: LB_CHANNEL, type: 'dispatchAck' } satisfies FromContentMessage);
        return;
      }
      void runProcessIndeedPage(message.actionId, message.payload, tabId);
    }
    sendResponse({ channel: LB_CHANNEL, type: 'dispatchAck' } satisfies FromContentMessage);
    return;
  }
}
