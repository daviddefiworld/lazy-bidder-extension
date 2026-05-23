import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CONNECTION_STORAGE_KEYS,
  connectionSettings
} from '../config/ConnectionSettingsStore';
import type { IndeedOrderParams } from '../skills/indeed/types';
import { IndeedOrderRunner } from '../skills/indeed/indeedRunner';
import type { ExtensionOrderPhase, OrderUiState } from '../orders/types';
import { actionCoordinator } from '../utils/actionCoordinator';
import { getGrokSkill } from '../skills/grok/grok';

export type { ExtensionOrderPhase, OrderUiState } from '../orders/types';
export type OrderState = OrderUiState;

const STORAGE_KEY = 'extensionId';

export type GrokRunOrderPayload = {
  orderId: string;
  message: string;
};

export const useSidebarSocket = () => {
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
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
  const connectInFlightRef = useRef(false);
  const runnerRef = useRef<IndeedOrderRunner | null>(null);
  const connectSocketRef = useRef<(() => void) | null>(null);
  const grokBusyRef = useRef(false);

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
      if (!socketRef.current?.connected && !connectInFlightRef.current) {
        connectSocketRef.current?.();
      }
    }, 5000);
  }, [clearRetry]);

  const updateOrderUi = useCallback(
    (
      order: { orderId: string; jobsFound: number; jobsScraped: number } | null,
      phase: ExtensionOrderPhase,
      error?: string
    ) => {
      if (!order) {
        setOrderState({
          phase,
          jobsFound: 0,
          jobsScraped: 0,
          site: undefined,
          orderId: undefined,
          grokMessage: undefined,
          grokReply: undefined,
          error
        });
        return;
      }
      setOrderState({
        phase,
        orderId: order.orderId,
        site: 'indeed',
        jobsFound: order.jobsFound,
        jobsScraped: order.jobsScraped,
        grokMessage: undefined,
        grokReply: undefined,
        error
      });
    },
    []
  );

  const ensureRunner = useCallback((): IndeedOrderRunner => {
    if (!runnerRef.current) {
      runnerRef.current = new IndeedOrderRunner({
        getExtensionId,
        emitOrderStatus: (payload) => emitSocket('action:result', payload as Record<string, unknown>),
        onOrderChange: updateOrderUi
      });
    }
    return runnerRef.current;
  }, [getExtensionId, emitSocket, updateOrderUi]);

  const runGrokOrderFromServer = useCallback(
    async (data: GrokRunOrderPayload) => {
      const id = await getExtensionId();
      if (!id || !data.orderId) return;

      if (ensureRunner().getActiveOrder()) {
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: 'Extension is busy with an Indeed order'
        });
        return;
      }
      if (grokBusyRef.current) {
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: 'Extension is already running a Grok order'
        });
        return;
      }

      const message = data.message?.trim();
      if (!message) {
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: 'Empty Grok message'
        });
        return;
      }

      grokBusyRef.current = true;
      setOrderState({
        phase: 'running',
        orderId: data.orderId,
        site: 'grok',
        jobsFound: 0,
        jobsScraped: 0,
        grokMessage: message,
        grokReply: undefined,
        error: undefined
      });

      emitSocket('action:result', {
        orderId: data.orderId,
        extensionId: id,
        status: 'executing'
      });

      try {
        const chat = await getGrokSkill().sendPrompt(message);
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'completed',
          completedAt: new Date().toISOString(),
          grokResult: {
            message: chat.message,
            ...(chat.conversationId ? { conversationId: chat.conversationId } : {})
          }
        });
        setOrderState({
          phase: 'completed',
          orderId: data.orderId,
          site: 'grok',
          jobsFound: 0,
          jobsScraped: 0,
          grokMessage: message,
          grokReply: chat.message,
          error: undefined
        });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: err
        });
        setOrderState({
          phase: 'completed',
          orderId: data.orderId,
          site: 'grok',
          jobsFound: 0,
          jobsScraped: 0,
          grokMessage: message,
          grokReply: undefined,
          error: err
        });
      } finally {
        grokBusyRef.current = false;
      }
    },
    [getExtensionId, emitSocket, ensureRunner]
  );

  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('connect', async () => {
      isConnectingRef.current = false;
      setSocketConnected(true);
      setConnectError(null);

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

    socket.on('connect_error', (err: Error) => {
      isConnectingRef.current = false;
      setSocketConnected(false);
      setConnectError(err?.message || 'Connection failed');
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

      if (grokBusyRef.current) {
        emitSocket('action:result', {
          orderId: data.orderId,
          extensionId: id,
          status: 'failed',
          error: 'Extension is busy with a Grok order'
        });
        return;
      }

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

    socket.on('extension:run_grok_order', (data: GrokRunOrderPayload) => {
      void runGrokOrderFromServer(data);
    });
  }, [
    readStoredExtensionId,
    clearRetry,
    startRetry,
    sendWithExtensionId,
    getExtensionId,
    persistExtensionId,
    ensureRunner,
    emitSocket,
    runGrokOrderFromServer
  ]);

  const connectSocket = useCallback(() => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;

    void (async () => {
      try {
        const { backendUrl, apiKey } = await connectionSettings.read();
        if (!apiKey.trim()) {
          clearRetry();
          socketRef.current?.removeAllListeners();
          socketRef.current?.disconnect();
          socketRef.current = null;
          setSocketConnected(false);
          setConnectError('Add an API key in settings below to connect.');
          return;
        }

        isConnectingRef.current = true;
        setConnectError(null);

        socketRef.current?.removeAllListeners();
        socketRef.current?.disconnect();

        try {
          socketRef.current = io(backendUrl, {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true,
            auth: { extension: true, apiKey: apiKey.trim() }
          });

          setupSocketListeners();
        } finally {
          isConnectingRef.current = false;
        }
      } finally {
        connectInFlightRef.current = false;
      }
    })();
  }, [setupSocketListeners, clearRetry]);

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

  useEffect(() => {
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes[CONNECTION_STORAGE_KEYS.apiKey] || changes[CONNECTION_STORAGE_KEYS.backendUrl]) {
        connectSocket();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [connectSocket]);

  return {
    socketConnected,
    connectError,
    extensionId,
    orderState
  };
};
