import React, { useState, useEffect } from 'react';
import { Login, Register, ControlPanel } from '../components';
import { useSidebarSocket } from '../hooks';
import './sidebar.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isAuthenticated: boolean;
}

type ViewMode = 'login' | 'register' | 'main';

const SidebarPage: React.FC = () => {
  const {
    socketConnected,
    isRunning,
    currentUser,
    isAuthenticated,
    authenticateUser: handleAuthenticateUser,
    registerUser: handleRegisterUser,
    logout: handleLogout,
    sendRunningStatus,
    handleUrlChange: handleSocketUrlChange,
    requestUrlChange
  } = useSidebarSocket();

  const [currentUrl, setCurrentUrl] = useState('');
  const [user, setUser] = useState<User>({ id: '', name: '', email: '', role: '', isAuthenticated: false });
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs[0]?.url) setCurrentUrl(tabs[0].url);
      
      if (currentUser && isAuthenticated) {
        setUser({ ...currentUser, isAuthenticated: true });
        setViewMode('main');
      }

      setIsLoading(false);
    };

    const handleMessage = async (message: any) => {
      if (message.action === 'urlChange') {
        setCurrentUrl(message.data.url);
        await handleSocketUrlChange(message.data);
      }
    };

    init();
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [currentUser, isAuthenticated, handleSocketUrlChange]);

  const toggleExtension = async () => {
    const newState = !isRunning;
    await sendRunningStatus(newState);
  };

  const handleLogin = async (email: string, password: string) => {
    const response = await handleAuthenticateUser(email, password);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }
    setUser({ ...response.data.user, isAuthenticated: true });
    setViewMode('main');
  };

  const handleRegister = async (name: string, email: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    const response = await handleRegisterUser(name, email, password);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Registration failed');
    }
    setUser({ ...response.data.user, isAuthenticated: true });
    setViewMode('main');
  };

  const onLogout = async () => {
    await handleLogout();
    setUser({ id: '', name: '', email: '', role: '', isAuthenticated: false });
    setViewMode('login');
  };

  const handleUrlChange = async (url: string) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const result = await requestUrlChange(tabs[0].id, url);
      if (result.success) {
        setCurrentUrl(url);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      if (target.value.trim()) {
        handleUrlChange(target.value.trim());
        target.value = '';
      }
    }
  };

  const handleGoClick = () => {
    const input = document.querySelector('input[type="url"]') as HTMLInputElement;
    if (input?.value.trim()) {
      handleUrlChange(input.value.trim());
      input.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="sidebar-container sidebar-loading">
        <div className="text-center sidebar-fade-in">
          <div className="sidebar-loading-spinner mx-auto mb-4"></div>
          <p className="sidebar-loading-text">Loading LazyBidder...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'login') {
    return (
      <div className="sidebar-container auth-container">
        <div className="sidebar-fade-in">
          <Login 
            onLogin={handleLogin}
            onRegister={() => setViewMode('register')}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'register') {
    return (
      <div className="sidebar-container auth-container">
        <div className="sidebar-fade-in">
          <Register 
            onRegister={handleRegister}
            onBackToLogin={() => setViewMode('login')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-container sidebar-main sidebar-slide-in">
      {/* Header */}
      <div className="sidebar-header">
        <h1 className="sidebar-header-title">LazyBidder</h1>
        <p className="sidebar-header-subtitle">Welcome, {user.name}</p>
      </div>

      {/* Status */}
      <div className="sidebar-status">
        <div className="sidebar-status-item">
          <span className="sidebar-status-label">Status:</span>
          <span className={`sidebar-status-badge ${isRunning ? 'sidebar-status-active' : 'sidebar-status-inactive'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="sidebar-status-item">
          <span className="sidebar-status-label">Backend:</span>
          <span className={`sidebar-status-badge ${socketConnected ? 'sidebar-status-connected' : 'sidebar-status-disconnected'}`}>
            {socketConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Control Panel */}
      <div className="sidebar-control">
        <button
          onClick={toggleExtension}
          className={`sidebar-control-button ${isRunning ? 'sidebar-control-button-active' : 'sidebar-control-button-inactive'}`}
        >
          {isRunning ? 'Stop Extension' : 'Start Extension'}
        </button>
      </div>

      {/* URL Navigation */}
      <div className="sidebar-url-nav">
        <p className="sidebar-url-label">Navigate to URL:</p>
        <div className="sidebar-url-input-group">
          <input
            type="url"
            placeholder="Enter URL..."
            className="sidebar-url-input"
            onKeyPress={handleKeyPress}
          />
          <button onClick={handleGoClick} className="sidebar-url-button">
            Go
          </button>
        </div>
        <p className="sidebar-url-current">Current URL:</p>
        <p className="sidebar-url-display">{currentUrl}</p>
      </div>

      {/* Control Panel */}
      <ControlPanel isRunning={isRunning} />

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={onLogout} className="sidebar-footer-button">
          Logout
        </button>
      </div>
    </div>
  );
};

export default SidebarPage;
