import { useState, useEffect } from 'react';
import { ExtensionState, User, ViewMode } from '../types/sidebar';
import sidebarSocketService from '../services/sidebarSocketService';

export const useSidebarState = () => {
  const [state, setState] = useState<ExtensionState>({
    isActive: false,
    currentUrl: '',
    socketConnected: false
  });
  
  const [user, setUser] = useState<User>({
    id: '',
    name: '',
    email: '',
    role: '',
    isAuthenticated: false
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [isLoading, setIsLoading] = useState(true);

  const updateState = (updates: Partial<ExtensionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  // Initialization logic
  useEffect(() => {
    console.log('useSidebarInitialization');
    let messageHandler: ((message: any, sender: any, sendResponse: any) => boolean | Promise<boolean>) | null = null;
    let statusCheckInterval: NodeJS.Timeout | null = null;
    
    const initialize = async () => {
      // Get current tab and stored state
      const [tabs, storage] = await Promise.all([
        chrome.tabs.query({ active: true, currentWindow: true }),
        chrome.storage.sync.get(['isActive', 'user'])
      ]);
      
      if (tabs[0]?.url) {
        setState(prev => ({ ...prev, currentUrl: tabs[0].url! }));
      }
      
      setState(prev => ({ ...prev, isActive: storage.isActive || false }));
      
      if (storage.user && sidebarSocketService.isAuthenticated()) {
        setUser({ ...storage.user, isAuthenticated: true });
        setViewMode('main');
      }

      setState(prev => ({ ...prev, socketConnected: sidebarSocketService.getConnectionStatus() }));

      statusCheckInterval = setInterval(() => {
        setState(prev => ({ ...prev, socketConnected: sidebarSocketService.getConnectionStatus() }));
      }, 5000);

      setIsLoading(false);
      
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.isActive) {
          setState(prev => ({ ...prev, isActive: changes.isActive.newValue }));
        }
      });
    };
    
    // Consolidated message handler
    messageHandler = async (message: any, sender: any, sendResponse: any) => {
      console.log('Message received:', message);
      const { action } = message;
      
      if (action === 'activation_command') {
        setState(prev => ({ ...prev, isActive: message.isActive }));
        await chrome.storage.sync.set({ isActive: message.isActive });
        await sidebarSocketService.sendActivationStatus(message.isActive);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle', isActive: message.isActive }).catch(() => {});
          }
        });
        sendResponse({ success: true });
        return true;
      }
      
      if (action === 'urlChange') {
        setState(prev => ({ ...prev, currentUrl: message.data.url }));
        await sidebarSocketService.handleUrlChange(message.data);
      }
      
      if (action === 'getSocketStatus') {
        sendResponse({
          connected: sidebarSocketService.getConnectionStatus(),
          authenticated: sidebarSocketService.isAuthenticated(),
          user: sidebarSocketService.getCurrentUser()
        });
        return true;
      }
      
      return false;
    };
    
    initialize().catch((error) => {
      console.error('Initialization error:', error);
      setIsLoading(false);
    });
    
    chrome.runtime.onMessage.addListener(messageHandler);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageHandler);
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, []);

  return {
    state,
    user,
    viewMode,
    isLoading,
    setState,
    setUser,
    setViewMode,
    setIsLoading,
    updateState,
    updateUser
  };
};
