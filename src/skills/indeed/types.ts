export interface IndeedOrderParams {
  orderId: string;
  sitename?: string;
  query: string;
  location: string;
  sort: string;
  fromage: string;
}

export interface ActiveIndeedOrder extends IndeedOrderParams {
  start: number;
  lastJobId?: string;
  tabId: number;
  jobsFound: number;
  jobsScraped: number;
}

export interface IndeedProgress {
  orderId: string;
  jobsFound: number;
  jobsScraped: number;
}

export interface IndeedJobResult {
  orderId: string;
  jobId: string;
  jobDetail: unknown;
}

export interface ProcessIndeedPagePayload {
  params: Pick<IndeedOrderParams, 'orderId' | 'query' | 'location' | 'sort' | 'fromage'>;
  totals: { jobsFound: number; jobsScraped: number };
  resumeAfterJobId?: string;
}

export interface ProcessIndeedPageResult {
  hasNext: boolean;
  totals: { jobsFound: number; jobsScraped: number };
}

export type InjectIndeedPageHookMessage = {
  channel: 'lazybidder';
  type: 'injectIndeedPageHook';
  tabId: number;
};

export type InjectIndeedPageHookResponse = { ok: true } | { ok: false; error: string };
