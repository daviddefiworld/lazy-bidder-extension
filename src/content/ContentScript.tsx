import React, { useState, useEffect } from 'react';

const ContentScript: React.FC = () => {
  const [currentUrl, setCurrentUrl] = useState(window.location.href);
  const [loadTime, setLoadTime] = useState(new Date().toLocaleTimeString());
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
      if (newUrl !== currentUrl) {
        console.log('URL changed within page:', newUrl);
        setCurrentUrl(newUrl);
        
        // Extension ID will be added by sidebar or background
        
        // Send URL change to backend
        chrome.runtime.sendMessage({
          action: 'sendUrlChange',
          data: {
            url: newUrl,
            previousUrl: currentUrl,
            title: document.title,
            timestamp: Date.now(),
            type: 'spa_navigation'
          }
        });
      }
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
  }, [currentUrl]);

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-gradient-to-r from-green-50 to-blue-50 shadow-2xl rounded-xl p-4 border-2 border-green-400 min-w-[300px]">
      <div className="flex items-center space-x-3">
        <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-lg font-bold text-gray-800">
          🚀 LazyBidder Active
        </span>
      </div>
      
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Status:</span>
          <span className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? '✅ Connected' : '❌ Disconnected'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Loaded:</span>
          <span className="text-gray-800 font-mono">{loadTime}</span>
        </div>
        
        <div className="mt-2 p-2 bg-white rounded-lg border">
          <div className="text-xs text-gray-500 mb-1">Current URL:</div>
          <div className="text-xs text-gray-800 font-mono break-all">
            {currentUrl.length > 50 ? `${currentUrl.substring(0, 50)}...` : currentUrl}
          </div>
        </div>
        
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
            Content Script Running
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContentScript;
