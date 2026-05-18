import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { IndeedOrderParams } from '../skills/indeed/types';
import { IndeedOrderRunner } from '../skills/indeed/indeedRunner';
import type { ExtensionOrderPhase, OrderUiState } from '../orders/types';
import { actionCoordinator } from '../utils/actionCoordinator';

export type { ExtensionOrderPhase, OrderUiState } from '../orders/types';
export type OrderState = OrderUiState;

const STORAGE_KEY = 'extensionId';

export const useSidebarSocket = () => {
  const [socketConnected, setSocketConnected] = useState(false);
  const [extensionId, setExtensionId] = useState('');
  const [orderState, setOrderState] = useState<OrderUiState>({
    phase: 'idle',
    jobsFound: 0,
    jobsScraped: 0
  });

  const socketRef = useRef<Socket | null>(null);
  const extensionIdRef = useRef('');
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const runnerRef = useRef<IndeedOrderRunner | null>(null);
  const connectSocketRef = useRef<(() => void) | null>(null);

  const readStoredExtensionId = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const id = typeof result[STORAGE_KEY] === 'string' ? result[STORAGE_KEY] : '';
        resolve(id);
      });
    });
  }, []);

  const persistExtensionId = useCallback((id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: id }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          extensionIdRef.current = id;
          setExtensionId(id);
          resolve();
        }
      });
    });
  }, []);

  const getExtensionId = useCallback(async (): Promise<string> => {
    if (extensionIdRef.current) {
      return extensionIdRef.current;
    }
    const stored = await readStoredExtensionId();
    extensionIdRef.current = stored;
    if (stored) {
      setExtensionId(stored);
    }
    return stored;
  }, [readStoredExtensionId]);

  const emitSocket = useCallback((event: string, payload: Record<string, unknown>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    }
  }, []);

  const sendWithExtensionId = useCallback(
    async (type: string, data: Record<string, unknown> = {}): Promise<void> => {
      const id = await getExtensionId();
      if (!id || !socketRef.current?.connected) return;
      socketRef.current.emit('extension:message', {
        type,
        data: { ...data, extensionId: id, timestamp: Date.now() }
      });
    },
    [getExtensionId]
  );

  const clearRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  const startRetry = useCallback(() => {
    clearRetry();
    retryIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected && !isConnectingRef.current) {
        connectSocketRef.current?.();
      }
    }, 5000);
  }, [clearRetry]);

  const updateOrderUi = useCallback(
    (order: { orderId: string; jobsFound: number; jobsScraped: number } | null, phase: ExtensionOrderPhase, error?: string) => {
      if (!order) {
        setOrderState({
          phase,
          jobsFound: 0,
          jobsScraped: 0,
          error
        });
        return;
      }
      setOrderState({
        phase,
        orderId: order.orderId,
        jobsFound: order.jobsFound,
        jobsScraped: order.jobsScraped,
        error
      });
    },
    []
  );

  const ensureRunner = useCallback((): IndeedOrderRunner => {
    if (!runnerRef.current) {
      runnerRef.current = new IndeedOrderRunner({
        getExtensionId,
        emitOrderStatus: (payload) => emitSocket('action:result', payload),
        onOrderChange: updateOrderUi
      });
    }
    return runnerRef.current;
  }, [getExtensionId, emitSocket, updateOrderUi]);

  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('connect', async () => {
      isConnectingRef.current = false;
      setSocketConnected(true);

      const storedId = await readStoredExtensionId();
      socket.emit('extension:connect', {
        ...(storedId ? { extensionId: storedId } : {}),
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      });
      clearRetry();
    });

    socket.on('disconnect', async (reason) => {
      isConnectingRef.current = false;
      setSocketConnected(false);
      await sendWithExtensionId('online_status', { isOnline: false });
      if (reason !== 'io client disconnect') {
        startRetry();
      }
    });

    socket.on('connect_error', () => {
      isConnectingRef.current = false;
      setSocketConnected(false);
      startRetry();
    });

    socket.on('extension:connected', async (data: { extensionId?: string }) => {
      if (!data.extensionId) return;
      await persistExtensionId(data.extensionId);
      await sendWithExtensionId('online_status', { isOnline: true });
    });

    socket.on('extension:run_order', async (data: IndeedOrderParams) => {
      const id = await getExtensionId();
      if (!id || !data.orderId) return;

      const runner = ensureRunner();
      if (runner.getActiveOrder()) {
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: 'Extension is busy with another order'
        });
        return;
      }

      await runner.start(data);
    });
  }, [
    readStoredExtensionId,
    clearRetry,
    startRetry,
    sendWithExtensionId,
    getExtensionId,
    persistExtensionId,
    ensureRunner,
    emitSocket
  ]);

  const connectSocket = useCallback(() => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();

    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: { extension: true }
    });

    setupSocketListeners();
    isConnectingRef.current = false;
  }, [setupSocketListeners]);

  connectSocketRef.current = connectSocket;

  useEffect(() => {
    actionCoordinator.ensureListener();
    actionCoordinator.setProgressHandler((data) => {
      ensureRunner().onProgress(data.orderId, data.jobsFound, data.jobsScraped);
    });
    actionCoordinator.setJobResultHandler(async (data) => {
      ensureRunner().onJobScraped(data.orderId, data.jobId);
      const extId = await getExtensionId();
      emitSocket('action:job_result', {
        orderId: data.orderId,
        extensionId: extId,
        jobId: data.jobId,
        jobDetail: data.jobDetail
      });
    });

    return () => {
      actionCoordinator.setProgressHandler(null);
      actionCoordinator.setJobResultHandler(null);
    };
  }, [ensureRunner, getExtensionId, emitSocket]);

  useEffect(() => {
    const onTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status !== 'complete') return;
      void ensureRunner().processCurrentPageIfReady(tabId);
    };

    chrome.tabs.onUpdated.addListener(onTabUpdated);
    return () => chrome.tabs.onUpdated.removeListener(onTabUpdated);
  }, [ensureRunner]);

  useEffect(() => {
    void (async () => {
      const stored = await readStoredExtensionId();
      if (stored) {
        extensionIdRef.current = stored;
        setExtensionId(stored);
      }
      await ensureRunner().restoreSession();
    })();

    connectSocket();
    return () => {
      clearRetry();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connectSocket, clearRetry, readStoredExtensionId, ensureRunner]);

  return {
    socketConnected,
    extensionId,
    orderState
  };
};
