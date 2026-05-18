export interface IndeedOrderParams {
  orderId: string;
  /** Job rows are stored with this site key (from backend order). */
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
