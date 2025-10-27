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

class SidebarSocketService {
  private socket: Socket | null = null;
  private authToken: string | null = null;
  private currentUser: any = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['authToken', 'user']);
      this.authToken = result.authToken || null;
      this.currentUser = result.user || null;
      
      if (this.authToken) {
        this.connect();
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
    }
  }

  private connect(): void {
    if (!this.authToken || this.isConnecting) return;

    this.isConnecting = true;
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:5000' 
      : 'http://localhost:5000';

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: { token: this.authToken }
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', async () => {
      console.log('Connected to backend');
      this.isConnecting = false;
      await this.onConnected();
    });

    this.socket.on('disconnect', async (reason) => {
      console.log('Disconnected:', reason);
      this.isConnecting = false;
      await this.onDisconnected(reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.startRetry();
    });

    this.socket.on('extension:activation_command', this.handleActivationCommand.bind(this));
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'emitActivationStatus') {
        this.sendActivationStatus(message.isActive);
      }
    });
  }

  private async onConnected(): Promise<void> {
    const extensionId = await this.getExtensionInstanceId();
    this.socket?.emit('extension:connect', { extensionId, timestamp: Date.now() });
    await this.sendOnlineStatus(true);
    this.clearRetry();
  }

  private async onDisconnected(reason: string): Promise<void> {
    await this.sendOnlineStatus(false);
    if (reason !== 'io client disconnect') {
      this.startRetry();
    }
  }

  private async handleActivationCommand(data: any): Promise<void> {
    console.log('Received activation command:', data);
    const extensionId = await this.getExtensionInstanceId();
    
    if (data.extensionId !== extensionId) return;

    const isActive = data.isActive ?? (data.action === 'activate');
    await chrome.storage.sync.set({ isActive });
    
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'activation_command',
          isActive
        }).catch(() => {});
      }
    });
    
    await this.sendActivationStatus(isActive);
  }

  private startRetry(): void {
    this.clearRetry();
    this.retryInterval = setInterval(() => {
      if (!this.socket?.connected && this.authToken && !this.isConnecting) {
        this.connect();
      }
    }, 5000);
  }

  private clearRetry(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  public sendMessage(type: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit('extension:message', { type, data, timestamp: Date.now() });
    } else {
      console.warn('Socket not connected:', { type, data });
    }
  }

  public disconnect(): void {
    this.clearRetry();
    this.socket?.disconnect();
    this.socket = null;
    this.isConnecting = false;
  }

  public getConnectionStatus(): boolean {
    return this.socket?.connected || false;
  }

  private async fetchAuth(url: string, body: any): Promise<AuthResponse> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: AuthResponse = await response.json();
      
      if (data.success && data.data) {
        this.authToken = data.data.token;
        this.currentUser = data.data.user;
        await chrome.storage.sync.set({ authToken: this.authToken, user: this.currentUser });
        this.connect();
      }
      return data;
    } catch (error) {
      return {
        success: false,
        message: 'Network error',
        error: 'Network error'
      };
    }
  }

  public async authenticateUser(email: string, password: string): Promise<AuthResponse> {
    return this.fetchAuth('http://localhost:5000/api/users/login', { email, password });
  }

  public async registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
    return this.fetchAuth('http://localhost:5000/api/users/register', { name, email, password });
  }

  public async logout(): Promise<void> {
    this.authToken = null;
    this.currentUser = null;
    await chrome.storage.sync.remove(['authToken', 'user']);
    this.disconnect();
  }

  public getCurrentUser(): any {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return !!this.authToken && !!this.currentUser;
  }

  private async getExtensionInstanceId(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getExtensionId' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response?.extensionId) {
          resolve(response.extensionId);
        } else {
          reject(new Error('No extension ID received'));
        }
      });
    });
  }

  private async sendWithExtensionId(type: string, data: any = {}): Promise<void> {
    const extensionId = await this.getExtensionInstanceId();
    this.sendMessage(type, { ...data, extensionId, timestamp: Date.now() });
  }

  public async sendActivationStatus(isActive: boolean): Promise<void> {
    await this.sendWithExtensionId('activation_status', { isActive });
  }

  public async sendOnlineStatus(isOnline: boolean): Promise<void> {
    await this.sendWithExtensionId('online_status', { isOnline });
  }

  public async sendUrlChange(data: any): Promise<void> {
    if (!data.extensionId) {
      data.extensionId = await this.getExtensionInstanceId();
    }
    this.sendMessage('url_change', data);
  }

  public async handleUrlChange(urlData: any): Promise<void> {
    if (this.isAuthenticated()) {
      await this.sendUrlChange(urlData);
    }
  }

  public async requestUrlChange(tabId: number, url: string): Promise<{ success: boolean; error?: string; tab?: any }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'changeUrl', tabId, url }, (response) => {
        resolve(chrome.runtime.lastError 
          ? { success: false, error: chrome.runtime.lastError.message }
          : response);
      });
    });
  }
}

const sidebarSocketService = new SidebarSocketService();
export default sidebarSocketService;
