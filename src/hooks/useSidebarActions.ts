import sidebarSocketService from '../services/sidebarSocketService';

interface UseSidebarActionsProps {
  setState: (updater: (prev: any) => any) => void;
  setUser: (user: any) => void;
  setViewMode: (mode: 'login' | 'register' | 'main') => void;
  state: any;
}

export const useSidebarActions = ({ setState, setUser, setViewMode, state }: UseSidebarActionsProps) => {
  const toggleExtension = async () => {
    const newState = !state.isActive;
    setState(prev => ({ ...prev, isActive: newState }));
    
    await chrome.storage.sync.set({ isActive: newState });
    
    // Send activation status to backend
    sidebarSocketService.sendActivationStatus(newState);
    
    // Send message to content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'toggle', 
        isActive: newState 
      });
    }
  };

  const updateAuthState = (userData: any) => {
    setUser({ ...userData, isAuthenticated: true });
    setViewMode('main');
    setState(prev => ({ ...prev, socketConnected: true }));
  };

  const handleLogin = async (email: string, password: string) => {
    const response = await sidebarSocketService.authenticateUser(email, password);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }
    updateAuthState(response.data.user);
  };

  const handleRegister = async (name: string, email: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    const response = await sidebarSocketService.registerUser(name, email, password);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Registration failed');
    }
    updateAuthState(response.data.user);
  };

  const handleLogout = async () => {
    await sidebarSocketService.logout();
    setUser({ id: '', name: '', email: '', role: '', isAuthenticated: false });
    setViewMode('login');
    setState(prev => ({ ...prev, socketConnected: false }));
  };

  const handleUrlChange = async (url: string) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const result = await sidebarSocketService.requestUrlChange(tabs[0].id, url);
      if (result.success) {
        setState(prev => ({ ...prev, currentUrl: url }));
      }
    }
  };

  return {
    toggleExtension,
    handleLogin,
    handleRegister,
    handleLogout,
    handleUrlChange
  };
};
