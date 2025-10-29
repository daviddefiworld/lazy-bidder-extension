import { actionExecutor } from '../services/actionExecutor';
import './content.css';

// Minimal notification widget
class LazyBidderNotification {
  private container: HTMLElement | null = null;
  public isVisible: boolean = false;

  constructor() {
    this.createNotification();
    this.show();
  }

  private createNotification(): void {
    // Remove existing notification if any
    const existing = document.getElementById('lazybidder-notification');
    if (existing) {
      existing.remove();
    }

    // Create minimal notification container
    this.container = document.createElement('div');
    this.container.id = 'lazybidder-notification';
    this.container.innerHTML = `
      <div class="lazybidder-widget">
        <div class="lazybidder-status" id="lazybidder-status">●</div>
        <span class="lazybidder-title">LazyBidder</span>
      </div>
    `;

    document.body.appendChild(this.container);
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      this.isVisible = true;
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  public updateStatus(connected: boolean): void {
    const statusElement = document.getElementById('lazybidder-status');
    if (statusElement) {
      statusElement.textContent = connected ? '●' : '○';
      statusElement.className = `lazybidder-status ${connected ? 'connected' : 'disconnected'}`;
    }
  }
}

// Initialize notification
let notification: LazyBidderNotification | null = null;

// Function to initialize content script
const initializeContentScript = (): void => {
  try {
    console.log('LazyBidder: Initializing content script...');
    
    // Create notification widget
    notification = new LazyBidderNotification();
    
    // Test connection to background script
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('LazyBidder: Background script not available:', chrome.runtime.lastError);
        notification?.updateStatus(false);
      } else {
        console.log('LazyBidder: Background script connection successful');
        notification?.updateStatus(true);
      }
    });

    console.log('LazyBidder: Content script initialized successfully');
  } catch (error) {
    console.error('LazyBidder: Error initializing content script:', error);
  }
};

// Message handler for communication with sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('LazyBidder: Content script received message:', message);
  
  // Handle ping to check if content script is available
  if (message.action === 'ping') {
    console.log('LazyBidder: Responding to ping');
    sendResponse({ success: true, message: 'Content script is available' });
    return true;
  }

  // Handle action execution from sidebar
  if (message.action === 'executeAction') {
    console.log('LazyBidder: Executing action:', message.actionType);
    
    // Execute action and send result back
    actionExecutor.executeAction(message.actionType, message.config)
      .then((result) => {
        console.log('LazyBidder: Action executed successfully:', result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error('LazyBidder: Action execution failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }


  // Handle show/hide notification
  if (message.action === 'toggleNotification') {
    if (notification) {
      if (notification.isVisible) {
        notification.hide();
      } else {
        notification.show();
      }
    }
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

// Track URL changes within the same page (for SPAs)
let currentUrl = window.location.href;

const handleUrlChange = (): void => {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log('LazyBidder: URL changed within page:', newUrl);
    currentUrl = newUrl;
    
    // Send URL change to background script
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

// Listen for URL changes
window.addEventListener('popstate', handleUrlChange);

// Override history methods to catch programmatic navigation
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  // DOM is already ready
  setTimeout(initializeContentScript, 100);
}

console.log('LazyBidder: Content script loaded and message handler registered');