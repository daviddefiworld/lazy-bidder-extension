/** Extension-side order lifecycle (site-agnostic). */

export type ExtensionOrderPhase = 'idle' | 'running' | 'stopped' | 'completed';

export interface OrderCheckpoint {
  orderId: string;
  sitename: string;
  /** Pagination offset (Indeed: `start` query param). */
  pageStart: number;
  lastJobId?: string;
  tabId: number;
  jobsFound: number;
  jobsScraped: number;
  params: Record<string, string>;
}

export type OrderSiteKind = 'indeed' | 'grok';

export interface OrderUiState {
  phase: ExtensionOrderPhase;
  orderId?: string;
  /** Which product last drove `running` / `completed` (Indeed scrape vs Grok chat). */
  site?: OrderSiteKind;
  jobsFound: number;
  jobsScraped: number;
  /** Grok dashboard order: user message. */
  grokMessage?: string;
  /** Grok dashboard order: assistant reply (after completion). */
  grokReply?: string;
  error?: string;
}
