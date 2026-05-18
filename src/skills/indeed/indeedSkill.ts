import type { IndeedOrderParams, IndeedJobResult, IndeedProgress } from './types';
import {
  LB_CHANNEL,
  type InjectIndeedPageHookResponse
} from '../../types/messages';

const JOB_LIST_SELECTOR = 'li.css-1ac2h1w';
const NEXT_PAGE_SELECTOR = 'a[data-testId="pagination-page-next"]';
const VIEWJOB_MSG = { source: 'lazybidder', kind: 'viewjob' } as const;
const PAGE_LOAD_TIMEOUT_MS = 60_000;
const VIEWJOB_TIMEOUT_MS = 20_000;
const STEP_DELAY_MIN_MS = 2_000;
const STEP_DELAY_MAX_MS = 5_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Uniform random delay in [STEP_DELAY_MIN_MS, STEP_DELAY_MAX_MS] before human-like pacing. */
function randomStepDelay(): Promise<void> {
  const span = STEP_DELAY_MAX_MS - STEP_DELAY_MIN_MS + 1;
  const ms = STEP_DELAY_MIN_MS + Math.floor(Math.random() * span);
  return sleep(ms);
}

async function waitForJobList(timeoutMs = PAGE_LOAD_TIMEOUT_MS): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (document.querySelector(JOB_LIST_SELECTOR)) {
      return;
    }
    await sleep(300);
  }
  throw new Error('Job list did not appear');
}

/** Indeed anchor ids are `sj_<jk>` or `job_<jk>`; jk is the hex key after the prefix. */
export function jobIdToJk(jobId: string): string {
  if (jobId.startsWith('sj_')) return jobId.slice(3);
  if (jobId.startsWith('job_')) return jobId.slice(4);
  return jobId;
}

function isIndeedJobId(id: string): boolean {
  return id.startsWith('sj_') || id.startsWith('job_');
}

export function collectJobIds(): string[] {
  const liElements = document.querySelectorAll(JOB_LIST_SELECTOR);
  return Array.from(liElements)
    .map((li) => {
      const job = li.querySelector('a');
      if (!job) return null;
      const href = job.getAttribute('href') || '';
      // Ensure job id exists, is valid, and href contains '/pagead'
      if (!isIndeedJobId(job.id)) return null;
      if (!href.includes('/pagead') && !href.includes('/rc/clk')) return null;
      return job.id;
    })
    .filter((id): id is string => !!id);
}

export function hasNextPage(): boolean {
  return !!document.querySelector(NEXT_PAGE_SELECTOR);
}

/**
 * Patches page `fetch` in the MAIN world. DOM `<script>` injection hits Indeed's CSP;
 * `chrome.scripting` only exists on the service worker, not in content scripts.
 */
async function installFetchHook(tabId: number): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    channel: LB_CHANNEL,
    type: 'injectIndeedPageHook',
    tabId
  })) as InjectIndeedPageHookResponse | undefined;
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
  if (!link) {
    throw new Error(`Job link not found: ${jobId}`);
  }

  const pending = waitForViewjob();
  link.click();
  return pending;
}

export type IndeedCallbacks = {
  onProgress: (progress: IndeedProgress) => void;
  onJobResult: (result: IndeedJobResult) => void;
};

/** Scrape all jobs on the current Indeed results page (no navigation). */
export async function processCurrentPage(
  tabId: number,
  params: IndeedOrderParams,
  callbacks: IndeedCallbacks,
  totals: { jobsFound: number; jobsScraped: number },
  options?: { resumeAfterJobId?: string }
): Promise<{ hasNext: boolean; pageJobCount: number }> {
  await installFetchHook(tabId);
  await randomStepDelay();
  await waitForJobList();

  let jobIds = collectJobIds();
  if (options?.resumeAfterJobId) {
    const idx = jobIds.indexOf(options.resumeAfterJobId);
    if (idx >= 0) {
      jobIds = jobIds.slice(idx + 1);
    }
  }
  totals.jobsFound += jobIds.length;
  callbacks.onProgress({
    orderId: params.orderId,
    jobsFound: totals.jobsFound,
    jobsScraped: totals.jobsScraped
  });

  console.log("jobIds", jobIds)
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
      console.warn('Indeed skill: job scrape failed', jobId, err);
    }
  }

  return { hasNext: hasNextPage(), pageJobCount: jobIds.length };
}
