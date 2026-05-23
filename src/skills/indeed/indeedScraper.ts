import { LB_CHANNEL, type FromContentMessage } from '../../types/messages';
import { INDEED_ACTION } from './indeedShared';
import type {
  IndeedJobResult,
  IndeedOrderParams,
  IndeedProgress,
  InjectIndeedPageHookMessage,
  InjectIndeedPageHookResponse,
  ProcessIndeedPagePayload
} from './types';

export { INDEED_ACTION };

const JOB_LIST_SELECTOR = 'li.css-1ac2h1w';
const NEXT_PAGE_SELECTOR = 'a[data-testId="pagination-page-next"]';
const VIEWJOB_MSG = { source: 'lazybidder', kind: 'viewjob' } as const;
const PAGE_LOAD_TIMEOUT_MS = 60_000;
const VIEWJOB_TIMEOUT_MS = 20_000;
const STEP_DELAY_MIN_MS = 2_000;
const STEP_DELAY_MAX_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomStepDelay(): Promise<void> {
  const span = STEP_DELAY_MAX_MS - STEP_DELAY_MIN_MS + 1;
  return sleep(STEP_DELAY_MIN_MS + Math.floor(Math.random() * span));
}

async function waitForJobList(timeoutMs = PAGE_LOAD_TIMEOUT_MS): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (document.querySelector(JOB_LIST_SELECTOR)) return;
    await sleep(300);
  }
  throw new Error('Job list did not appear');
}

function isIndeedJobId(id: string): boolean {
  return id.startsWith('sj_') || id.startsWith('job_');
}

function collectJobIds(): string[] {
  const liElements = document.querySelectorAll(JOB_LIST_SELECTOR);
  return Array.from(liElements)
    .map((li) => {
      const job = li.querySelector('a');
      if (!job) return null;
      const href = job.getAttribute('href') || '';
      if (!isIndeedJobId(job.id)) return null;
      if (!href.includes('/pagead') && !href.includes('/rc/clk')) return null;
      return job.id;
    })
    .filter((id): id is string => !!id);
}

function hasNextPage(): boolean {
  return !!document.querySelector(NEXT_PAGE_SELECTOR);
}

async function installFetchHook(tabId: number): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    channel: LB_CHANNEL,
    type: 'injectIndeedPageHook',
    tabId
  } satisfies InjectIndeedPageHookMessage)) as InjectIndeedPageHookResponse | undefined;
  if (!response?.ok) {
    throw new Error(
      response && 'error' in response ? response.error : 'Failed to inject Indeed page hook'
    );
  }
}

function waitForViewjob(timeoutMs = VIEWJOB_TIMEOUT_MS): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('viewjob timeout'));
    }, timeoutMs);

    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (
        !d ||
        typeof d !== 'object' ||
        d.source !== VIEWJOB_MSG.source ||
        d.kind !== VIEWJOB_MSG.kind ||
        !('data' in d)
      ) {
        return;
      }
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(d.data);
    };

    window.addEventListener('message', onMessage);
  });
}

async function clickJobAndCapture(jobId: string): Promise<unknown> {
  const link = document.getElementById(jobId);
  if (!link) throw new Error(`Job link not found: ${jobId}`);
  const pending = waitForViewjob();
  link.click();
  return pending;
}

type PageCallbacks = {
  onProgress: (progress: IndeedProgress) => void;
  onJobResult: (result: IndeedJobResult) => void;
};

async function scrapeCurrentPage(
  tabId: number,
  params: IndeedOrderParams,
  callbacks: PageCallbacks,
  totals: { jobsFound: number; jobsScraped: number },
  options?: { resumeAfterJobId?: string }
): Promise<{ hasNext: boolean; pageJobCount: number }> {
  await installFetchHook(tabId);
  await randomStepDelay();
  await waitForJobList();

  let jobIds = collectJobIds();
  if (options?.resumeAfterJobId) {
    const idx = jobIds.indexOf(options.resumeAfterJobId);
    if (idx >= 0) jobIds = jobIds.slice(idx + 1);
  }

  totals.jobsFound += jobIds.length;
  callbacks.onProgress({
    orderId: params.orderId,
    jobsFound: totals.jobsFound,
    jobsScraped: totals.jobsScraped
  });

  for (const jobId of jobIds) {
    try {
      await randomStepDelay();
      const jobDetail = await clickJobAndCapture(jobId);
      totals.jobsScraped += 1;
      callbacks.onJobResult({ orderId: params.orderId, jobId, jobDetail });
      callbacks.onProgress({
        orderId: params.orderId,
        jobsFound: totals.jobsFound,
        jobsScraped: totals.jobsScraped
      });
    } catch (err) {
      console.warn('Indeed: job scrape failed', jobId, err);
    }
  }

  return { hasNext: hasNextPage(), pageJobCount: jobIds.length };
}

function notifySidebar(message: FromContentMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

export async function runIndeedPageAction(
  actionId: string,
  payload: ProcessIndeedPagePayload,
  tabId: number
): Promise<void> {
  const params = payload.params as IndeedOrderParams;
  const totals = { ...payload.totals };

  try {
    const pageResult = await scrapeCurrentPage(
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
