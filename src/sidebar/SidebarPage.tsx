import React from 'react';
import { useSidebarState, useSidebarActions } from '../hooks';
import { Login, Register, Header, StatusPanel, ControlPanel, UrlNavigation, Footer } from '../components';
import './sidebar.css';

const SidebarPage: React.FC = () => {
  const { state, user, viewMode, isLoading, setState, setUser, setViewMode, setIsLoading } = useSidebarState();

  const { toggleExtension, handleLogin, handleRegister, handleLogout, handleUrlChange } = useSidebarActions({
    setState,
    setUser,
    setViewMode,
    state
  });

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

  // Show login form if not authenticated
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

  // Show register form
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

  // Show main interface if authenticated
  return (
    <div className="sidebar-container sidebar-main sidebar-slide-in">
      <Header userName={user.name} />
      <StatusPanel isActive={state.isActive} socketConnected={state.socketConnected} />
      <ControlPanel isActive={state.isActive} onToggle={toggleExtension} />
      <UrlNavigation currentUrl={state.currentUrl} onUrlChange={handleUrlChange} />
      <Footer onLogout={handleLogout} />
    </div>
  );
};

export default SidebarPage;
