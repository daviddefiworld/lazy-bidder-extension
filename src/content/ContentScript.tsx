import React, { useState, useEffect } from 'react';

const ContentScript: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Test connection to background script
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Background script not available:', chrome.runtime.lastError);
        setIsConnected(false);
      } else {
        console.log('Background script connection successful');
        setIsConnected(true);
      }
    });

    // Track URL changes within the same page (for SPAs)
    const handleUrlChange = async () => {
      const newUrl = window.location.href;
      
      // Send URL change to backend
      chrome.runtime.sendMessage({
        action: 'sendUrlChange',
        data: {
          url: newUrl,
          title: document.title,
          timestamp: Date.now(),
          type: 'spa_navigation'
        }
      });
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleUrlChange);
    
    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(handleUrlChange, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleUrlChange, 0);
    };

    // Cleanup listeners
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return (
    <div className="fixed top-2 right-2 z-[9999] bg-white/90 shadow-sm rounded-md px-2 py-1 border border-gray-200">
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600 font-medium">LazyBidder</span>
      </div>
    </div>
  );
};

export default ContentScript;
