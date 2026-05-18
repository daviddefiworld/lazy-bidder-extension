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

export interface OrderUiState {
  phase: ExtensionOrderPhase;
  orderId?: string;
  jobsFound: number;
  jobsScraped: number;
  error?: string;
}
