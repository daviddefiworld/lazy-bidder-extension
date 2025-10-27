# LazyBidder Chrome Extension

A Chrome extension built with React, TypeScript, and Tailwind CSS.

## Features

- Modern React-based sidebar interface
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

```
src/
├── sidebar/         # Extension sidebar interface
├── content/         # Content script for web pages
└── background/      # Background service worker

public/
└── manifest.json    # Extension manifest
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
- Chrome Extension Manifest V3
