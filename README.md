# LazyBidder Chrome Extension

A Chrome extension built with React, TypeScript, and Tailwind CSS (Manifest V3, **side panel** UI).

## Features

- React-based **side panel** (`SidebarPage`) for status and socket-backed activity
- Content script integration
- Background service worker
- Tailwind CSS for styling
- TypeScript support
- Webpack bundling

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development mode:

   ```bash
   npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

### Loading the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Project Structure

```text
src/
├── sidebar/         # Side panel UI
├── hooks/           # useSidebarSocket (Socket.io + URL sync)
├── components/      # ControlPanel and other UI (optional wiring)
├── content/         # Content scripts for web pages
├── background/      # Service worker (tabs, message bridge)
└── services/        # Action execution helpers

public/
└── manifest.json    # Extension manifest (side_panel, permissions)
```

## Scripts

- `npm run dev` - Start development mode with file watching
- `npm run build` - Build for production
- `npm run clean` - Clean dist folder

## Technologies Used

- React 18
- TypeScript
- Tailwind CSS
- Webpack 5
- Socket.io client (real-time backend connection from the side panel)
- Chrome Extension Manifest V3
