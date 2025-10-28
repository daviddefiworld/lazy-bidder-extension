import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
  error?: string;
}

export const useSidebarSocket = () => {
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const isRunningRef = useRef(false);

  // Update ref when state changes
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Get extension instance ID
  const getExtensionInstanceId = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['extensionInstanceId'], (result) => {
        if (result.extensionInstanceId) {
          resolve(result.extensionInstanceId);
        } else {
          const id = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.storage.local.set({ extensionInstanceId: id }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(id);
            }
          });
        }
      });
    });
  }, []);

  // Send message
  const sendMessage = useCallback((type: string, data: any): void => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('extension:message', { type, data, timestamp: Date.now() });
    } else {
      console.warn('Socket not connected:', { type, data });
    }
  }, []);

  // Send with extension ID
  const sendWithExtensionId = useCallback(async (type: string, data: any = {}): Promise<void> => {
    const extensionId = await getExtensionInstanceId();
    sendMessage(type, { ...data, extensionId, timestamp: Date.now() });
  }, [getExtensionInstanceId, sendMessage]);

  // Clear retry interval
  const clearRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  // Start retry connection
  const startRetry = useCallback(() => {
    clearRetry();
    retryIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected && authToken && !isConnectingRef.current) {
        connectSocket();
      }
    }, 5000);
  }, [authToken]);

  // Setup socket listeners
  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('connect', async () => {
      console.log('Connected to backend');
      isConnectingRef.current = false;
      setSocketConnected(true);
      const extensionId = await getExtensionInstanceId();
      socket.emit('extension:connect', { extensionId, timestamp: Date.now() });
      await sendOnlineStatus(true);
      clearRetry();
    });

    socket.on('disconnect', async (reason) => {
      console.log('Disconnected:', reason);
      isConnectingRef.current = false;
      setSocketConnected(false);
      await sendOnlineStatus(false);
      if (reason !== 'io client disconnect') {
        startRetry();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      isConnectingRef.current = false;
      setSocketConnected(false);
      startRetry();
    });

    socket.on('extension:running_command', async (data: any) => {
      console.log('Received running command:', data);
      const extensionId = await getExtensionInstanceId();
      
      if (data.extensionId !== extensionId) return;

      const newRunningState = data.isRunning ?? (data.action === 'start');
      setIsRunning(newRunningState);
    });

    socket.on('extension:connected', (data: any) => {
      console.log('Extension connected:', data);
      if (data.isRunning !== undefined) {
        setIsRunning(data.isRunning);
      }
    });

    socket.on('action:order', async (data: any) => {
      try {
        const extensionId = await getExtensionInstanceId();
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
          throw new Error('No active tab found');
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'executeAction',
            actionType: data.actionType,
            config: data.actionConfig,
            orderId: data.orderId
          },
          (result) => {
            const actionResult = {
              orderId: data.orderId,
              extensionId,
              status: result?.success ? 'completed' : 'failed',
              result: result?.result,
              error: result?.error,
              executedAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            };
            
            if (socketRef.current?.connected) {
              socketRef.current.emit('action:result', actionResult);
            }
          }
        );
      } catch (error) {
        console.error('Error handling action order:', error);
        const extensionId = await getExtensionInstanceId();
        const errorResult = {
          orderId: data.orderId,
          extensionId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString()
        };
        
        if (socketRef.current?.connected) {
          socketRef.current.emit('action:result', errorResult);
        }
      }
    });
  }, [getExtensionInstanceId, clearRetry, startRetry]);

  // Connect socket
  const connectSocket = useCallback(() => {
    if (!authToken || isConnectingRef.current) return;

    isConnectingRef.current = true;
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:5000' 
      : 'http://localhost:5000';

    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: { token: authToken }
    });

    setupSocketListeners();
  }, [authToken, setupSocketListeners]);

  // Send online status
  const sendOnlineStatus = useCallback(async (isOnline: boolean): Promise<void> => {
    await sendWithExtensionId('online_status', { isOnline });
  }, [sendWithExtensionId]);

  // Initialize auth data
  useEffect(() => {
    const init = async () => {
      try {
        const result = await chrome.storage.sync.get(['authToken', 'user']);
        setAuthToken(result.authToken || null);
        setCurrentUser(result.user || null);
      } catch (error) {
        console.error('Error loading auth data:', error);
      }
    };

    init();
  }, []);

  // Connect when authToken is available
  useEffect(() => {
    if (authToken) {
      connectSocket();
    }

    return () => {
      if (!authToken) {
        clearRetry();
        socketRef.current?.disconnect();
        socketRef.current = null;
      }
    };
  }, [authToken, connectSocket, clearRetry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetry();
      socketRef.current?.disconnect();
    };
  }, [clearRetry]);

  // Fetch auth
  const fetchAuth = useCallback(async (url: string, body: any): Promise<AuthResponse> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: AuthResponse = await response.json();
      
      if (data.success && data.data) {
        setAuthToken(data.data.token);
        setCurrentUser(data.data.user);
        await chrome.storage.sync.set({ authToken: data.data.token, user: data.data.user });
        // Socket connection will be triggered by authToken useEffect
      }
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Network error',
        error: 'Network error'
      };
    }
  }, []);

  // Public methods
  const authenticateUser = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    return fetchAuth('http://localhost:5000/api/users/login', { email, password });
  }, [fetchAuth]);

  const registerUser = useCallback(async (name: string, email: string, password: string): Promise<AuthResponse> => {
    return fetchAuth('http://localhost:5000/api/users/register', { name, email, password });
  }, [fetchAuth]);

  const logout = useCallback(async (): Promise<void> => {
    setAuthToken(null);
    setCurrentUser(null);
    await chrome.storage.sync.remove(['authToken', 'user']);
    clearRetry();
    socketRef.current?.disconnect();
    socketRef.current = null;
    isConnectingRef.current = false;
    setSocketConnected(false);
  }, [clearRetry]);

  const sendRunningStatus = useCallback(async (runningState: boolean): Promise<void> => {
    setIsRunning(runningState);
    await sendWithExtensionId('running_status', { isRunning: runningState });
  }, [sendWithExtensionId]);

  const sendUrlChange = useCallback(async (data: any): Promise<void> => {
    if (!data.extensionId) {
      data.extensionId = await getExtensionInstanceId();
    }
    sendMessage('url_change', data);
  }, [getExtensionInstanceId, sendMessage]);

  const handleUrlChange = useCallback(async (urlData: any): Promise<void> => {
    if (authToken && currentUser) {
      await sendUrlChange(urlData);
    }
  }, [authToken, currentUser, sendUrlChange]);

  const requestUrlChange = useCallback(async (tabId: number, url: string): Promise<{ success: boolean; error?: string; tab?: any }> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'changeUrl', tabId, url }, (response) => {
        resolve(chrome.runtime.lastError 
          ? { success: false, error: chrome.runtime.lastError.message }
          : response);
      });
    });
  }, []);

  return {
    // State
    socketConnected,
    isRunning,
    currentUser,
    isAuthenticated: !!authToken && !!currentUser,

    // Methods
    authenticateUser,
    registerUser,
    logout,
    sendRunningStatus,
    sendUrlChange,
    handleUrlChange,
    requestUrlChange,
    getConnectionStatus: () => socketConnected,
    getIsRunning: () => isRunning,
    getCurrentUser: () => currentUser,
  };
};
