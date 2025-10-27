import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentScript from './ContentScript';
import './content.css';

// Initialize the content script
let container: HTMLElement | null = null;
let root: any = null;

// Function to create the React app
const createApp = () => {
  if (!container) {
    container = document.createElement('div');
    container.id = 'lazybidder-extension-root';
    document.body.appendChild(container);
    root = createRoot(container);
  }
  root.render(<ContentScript />);
};

// Function to destroy the React app
const destroyApp = () => {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
    container = null;
    root = null;
  }
};

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle') {
    if (message.isActive) {
      createApp();
    } else {
      destroyApp();
    }
  }
});

// Check initial state
chrome.storage.sync.get(['isActive'], (result) => {
  if (result.isActive) {
    createApp();
  }
});
