import React from 'react';
import { UrlNavigationProps } from '../types/sidebar';

const UrlNavigation: React.FC<UrlNavigationProps> = ({ currentUrl, onUrlChange }) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      if (target.value.trim()) {
        onUrlChange(target.value.trim());
        target.value = '';
      }
    }
  };

  const handleGoClick = () => {
    const input = document.querySelector('input[type="url"]') as HTMLInputElement;
    if (input?.value.trim()) {
      onUrlChange(input.value.trim());
      input.value = '';
    }
  };

  return (
    <div className="sidebar-url-nav">
      <p className="sidebar-url-label">Navigate to URL:</p>
      <div className="sidebar-url-input-group">
        <input
          type="url"
          placeholder="Enter URL..."
          className="sidebar-url-input"
          onKeyPress={handleKeyPress}
        />
        <button
          onClick={handleGoClick}
          className="sidebar-url-button"
        >
          Go
        </button>
      </div>
      <p className="sidebar-url-current">Current URL:</p>
      <p className="sidebar-url-display">{currentUrl}</p>
    </div>
  );
};

export default UrlNavigation;
