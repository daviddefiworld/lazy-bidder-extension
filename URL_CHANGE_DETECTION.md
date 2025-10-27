# URL Change Detection Implementation

This document explains how the LazyBidder extension detects and sends URL changes to the server.

## Overview

The extension now detects URL changes in two ways:
1. **Tab-level changes**: When users navigate to different pages/tabs
2. **SPA navigation**: When users navigate within single-page applications (like React Router, Vue Router, etc.)

## Implementation Details

### 1. Socket Service (`src/services/socketService.ts`)

Added a new method `sendUrlChange()` that sends URL change events to the server:

```typescript
public sendUrlChange(urlData: any): void {
  const message: SocketMessage = {
    type: 'URL_CHANGE',
    data: urlData,
    timestamp: Date.now()
  };
  this.sendMessage(message);
}
```

### 2. Background Script (`src/background/index.ts`)

Enhanced the background script to:
- Handle `sendUrlChange` messages from content scripts
- Detect URL changes via `chrome.tabs.onUpdated` listener
- Send URL change events to the server when authenticated

Key features:
- Detects when `changeInfo.url` changes (new page navigation)
- Sends URL change data including tab ID, timestamp, and extension ID
- Only sends data when user is authenticated

### 3. Content Script (`src/content/ContentScript.tsx`)

Enhanced the content script to detect URL changes within the same page:
- Monitors `popstate` events (back/forward navigation)
- Intercepts `history.pushState` and `history.replaceState` calls
- Tracks current URL state and detects changes
- Sends URL change events for SPA navigation

### 4. Manifest Permissions (`public/manifest.json`)

Added `tabs` permission to access tab information for URL change detection.

## Data Structure

URL change events sent to the server include:

```typescript
{
  url: string,           // Current URL
  previousUrl?: string,  // Previous URL (for SPA navigation)
  tabId: number,         // Chrome tab ID
  timestamp: number,     // Unix timestamp
  extensionId: string,   // Extension ID
  title?: string,        // Page title
  type?: string          // 'spa_navigation' for SPA changes
}
```

## Usage

The URL change detection works automatically when:
1. User is authenticated with the extension
2. Extension is active
3. User navigates to different pages or within SPAs

No additional configuration is required.

## Testing

To test URL change detection:
1. Ensure the extension is authenticated
2. Navigate to different pages - check browser console for "URL changed" logs
3. Navigate within SPAs (like React apps) - check for "URL changed within page" logs
4. Check server logs for incoming URL change events

## Server Integration

The server should listen for `URL_CHANGE` events via WebSocket to receive URL change notifications from authenticated extension users.
