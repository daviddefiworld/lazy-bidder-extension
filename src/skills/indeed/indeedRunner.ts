import { saveCheckpoint, removeCheckpoint, loadCheckpoint } from '../../orders/checkpointStorage';
import type { OrderCheckpoint } from '../../orders/types';
import { actionCoordinator } from '../../utils/actionCoordinator';
import { buildIndeedSearchUrl, INDEED_ACTION } from './indeedShared';
import type {
  ActiveIndeedOrder,
  IndeedOrderParams,
  ProcessIndeedPagePayload,
  ProcessIndeedPageResult
} from './types';

const SESSION_KEY = 'activeIndeedOrder';

export type IndeedRunnerCallbacks = {
  getExtensionId: () => Promise<string>;
  emitOrderStatus: (payload: {
    orderId: string;
    extensionId: string;
    status: string;
    error?: string;
    completedAt?: string;
  }) => void;
  onOrderChange: (
    order: ActiveIndeedOrder | null,
    phase: 'running' | 'stopped' | 'completed',
    error?: string
  ) => void;
};

export class IndeedOrderRunner {
  private active: ActiveIndeedOrder | null = null;
  private processingPage = false;

  constructor(private readonly callbacks: IndeedRunnerCallbacks) {}

  getActiveOrder(): ActiveIndeedOrder | null {
    return this.active;
  }

  async restoreSession(): Promise<void> {
    const session = await chrome.storage.session.get(SESSION_KEY);
    const saved = session[SESSION_KEY] as ActiveIndeedOrder | undefined;
    if (saved?.orderId) {
      this.active = saved;
      this.callbacks.onOrderChange(saved, 'running');
    }
  }

  private async persistSession(): Promise<void> {
    if (this.active) {
      await chrome.storage.session.set({ [SESSION_KEY]: this.active });
    } else {
      await chrome.storage.session.remove(SESSION_KEY);
    }
  }

  private toCheckpoint(order: ActiveIndeedOrder): OrderCheckpoint {
    return {
      orderId: order.orderId,
      sitename: order.sitename ?? 'indeed',
      pageStart: order.start,
      lastJobId: order.lastJobId,
      tabId: order.tabId,
      jobsFound: order.jobsFound,
      jobsScraped: order.jobsScraped,
      params: {
        query: order.query,
        location: order.location,
        sort: order.sort,
        fromage: order.fromage
      }
    };
  }

  private checkpointToOrder(cp: OrderCheckpoint): ActiveIndeedOrder {
    return {
      orderId: cp.orderId,
      sitename: cp.sitename,
      query: cp.params.query ?? '',
      location: cp.params.location ?? '',
      sort: cp.params.sort ?? 'date',
      fromage: cp.params.fromage ?? '7',
      start: cp.pageStart,
      lastJobId: cp.lastJobId,
      tabId: cp.tabId,
      jobsFound: cp.jobsFound,
      jobsScraped: cp.jobsScraped
    };
  }

  async stop(reason?: string): Promise<void> {
    const order = this.active;
    if (!order) return;

    actionCoordinator.cancelAll('Order stopped');
    this.processingPage = false;

    const checkpoint = this.toCheckpoint(order);
    await saveCheckpoint(checkpoint);
    this.active = null;
    await this.persistSession();
    this.callbacks.onOrderChange(null, 'stopped', reason);

    const extId = await this.callbacks.getExtensionId();
    this.callbacks.emitOrderStatus({
      orderId: checkpoint.orderId,
      extensionId: extId,
      status: 'stopped',
      error: reason
    });
  }

  async cancel(reason?: string): Promise<void> {
    const order = this.active;
    if (!order) return;

    actionCoordinator.cancelAll('Cancelled');
    this.processingPage = false;
    const orderId = order.orderId;
    await removeCheckpoint(orderId);
    this.active = null;
    await this.persistSession();
    this.callbacks.onOrderChange(null, 'completed', reason);

    const extId = await this.callbacks.getExtensionId();
    this.callbacks.emitOrderStatus({
      orderId,
      extensionId: extId,
      status: 'cancelled',
      error: reason,
      completedAt: new Date().toISOString()
    });
  }

  async complete(): Promise<void> {
    const order = this.active;
    if (!order) return;

    actionCoordinator.cancelAll('Order finished');
    this.processingPage = false;
    const orderId = order.orderId;
    await removeCheckpoint(orderId);
    this.active = null;
    await this.persistSession();
    this.callbacks.onOrderChange(null, 'completed');

    const extId = await this.callbacks.getExtensionId();
    this.callbacks.emitOrderStatus({
      orderId,
      extensionId: extId,
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  async start(params: IndeedOrderParams): Promise<void> {
    const url = buildIndeedSearchUrl(params, 0);
    const tabId = await this.openIndeedTab(url);

    const order: ActiveIndeedOrder = {
      ...params,
      sitename: params.sitename ?? 'indeed',
      start: 0,
      tabId,
      jobsFound: 0,
      jobsScraped: 0
    };

    this.active = order;
    await this.persistSession();
    this.callbacks.onOrderChange(order, 'running');

    const extId = await this.callbacks.getExtensionId();
    this.callbacks.emitOrderStatus({
      orderId: params.orderId,
      extensionId: extId,
      status: 'executing'
    });
  }

  async resume(params: IndeedOrderParams): Promise<void> {
    const checkpoint = await loadCheckpoint(params.orderId);

    let order: ActiveIndeedOrder;
    if (checkpoint) {
      order = this.checkpointToOrder(checkpoint);
      order = { ...order, ...params, sitename: params.sitename ?? order.sitename };
    } else {
      const url = buildIndeedSearchUrl(params, 0);
      const tabId = await this.openIndeedTab(url);
      order = {
        ...params,
        sitename: params.sitename ?? 'indeed',
        start: 0,
        tabId,
        jobsFound: 0,
        jobsScraped: 0
      };
    }

    this.active = order;
    await this.persistSession();
    this.callbacks.onOrderChange(order, 'running');

    const extId = await this.callbacks.getExtensionId();
    this.callbacks.emitOrderStatus({
      orderId: params.orderId,
      extensionId: extId,
      status: 'executing'
    });

    const url = buildIndeedSearchUrl(order, order.start);
    await chrome.tabs.update(order.tabId, { url });
  }

  onJobScraped(orderId: string, jobId: string): void {
    const order = this.active;
    if (!order || order.orderId !== orderId) return;
    order.lastJobId = jobId;
    void this.persistSession();
    void saveCheckpoint(this.toCheckpoint(order));
  }

  onProgress(orderId: string, jobsFound: number, jobsScraped: number): void {
    const order = this.active;
    if (!order || order.orderId !== orderId) return;
    order.jobsFound = jobsFound;
    order.jobsScraped = jobsScraped;
    this.callbacks.onOrderChange(order, 'running');
    void this.persistSession();
  }

  async processCurrentPageIfReady(tabId: number): Promise<void> {
    const order = this.active;
    if (!order || tabId !== order.tabId || this.processingPage) return;

    const expected = buildIndeedSearchUrl(order, order.start);
    const tab = await chrome.tabs.get(tabId);
    const tabUrl = tab.url?.split('#')[0] ?? '';
    const expectedUrl = expected.split('#')[0];
    if (tabUrl !== expectedUrl && !tabUrl.startsWith(expectedUrl)) return;

    await this.processPage();
  }

  async processPage(): Promise<void> {
    const order = this.active;
    if (!order || this.processingPage) return;

    this.processingPage = true;
    try {
      await actionCoordinator.waitForTabReady(order.tabId);

      const result = await actionCoordinator.dispatch<ProcessIndeedPageResult>(
        order.tabId,
        INDEED_ACTION,
        {
          params: {
            orderId: order.orderId,
            query: order.query,
            location: order.location,
            sort: order.sort,
            fromage: order.fromage
          },
          totals: { jobsFound: order.jobsFound, jobsScraped: order.jobsScraped },
          resumeAfterJobId: order.lastJobId
        } satisfies ProcessIndeedPagePayload
      );

      order.jobsFound = result.totals.jobsFound;
      order.jobsScraped = result.totals.jobsScraped;
      this.callbacks.onOrderChange(order, 'running');
      await this.persistSession();
      await saveCheckpoint(this.toCheckpoint(order));

      if (result.hasNext) {
        order.start += 10;
        order.lastJobId = undefined;
        const nextUrl = buildIndeedSearchUrl(order, order.start);
        await chrome.tabs.update(order.tabId, { url: nextUrl });
      } else {
        await this.complete();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'Order stopped' || msg === 'Cancelled') return;
      await this.stop(msg);
    } finally {
      this.processingPage = false;
    }
  }

  private async openIndeedTab(url: string): Promise<number> {
    const indeedTabs = await chrome.tabs.query({ url: '*://*.indeed.com/*' });
    if (indeedTabs[0]?.id) {
      await chrome.tabs.update(indeedTabs[0].id, { url, active: true });
      return indeedTabs[0].id;
    }
    const tab = await chrome.tabs.create({ url, active: true });
    if (!tab.id) throw new Error('Failed to open Indeed tab');
    return tab.id;
  }
}
