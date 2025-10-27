import React, { useState, useEffect } from 'react';

const ContentScript: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(window.location.href);

  useEffect(() => {
    // Get initial state
    chrome.storage.sync.get(['isActive'], (result) => {
      setIsActive(result.isActive || false);
    });

    // Check socket connection status
    chrome.runtime.sendMessage({ action: 'getSocketStatus' }, (response) => {
      if (response) {
        setSocketConnected(response.connected);
      }
    });

    // Listen for socket responses and activation commands
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SOCKET_RESPONSE') {
        console.log('Socket response received:', message.data);
      }
      
      if (message.action === 'activation_command') {
        console.log('Content script received activation command:', message);
        setIsActive(message.isActive);
      }
    });


    // Track URL changes within the same page (for SPAs)
    const handleUrlChange = async () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log('URL changed within page:', newUrl);
        setCurrentUrl(newUrl);
        
        // Get unique extension instance ID
        const extensionInstanceId = await new Promise<string>((resolve) => {
          chrome.storage.local.get(['extensionInstanceId'], (result) => {
            resolve(result.extensionInstanceId || '');
          });
        });
        
        // Send URL change to backend
        chrome.runtime.sendMessage({
          action: 'sendUrlChange',
          data: {
            url: newUrl,
            previousUrl: currentUrl,
            title: document.title,
            timestamp: Date.now(),
            type: 'spa_navigation',
            extensionId: extensionInstanceId
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
    <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4 border border-gray-200">
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        <span className="text-sm font-medium text-gray-700">
          LazyBidder {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      
      <div className="mt-2 flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-blue-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-gray-500">
          Backend {socketConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        <p>Extension is running on this page</p>
      </div>
    </div>
  );
};

export default ContentScript;
