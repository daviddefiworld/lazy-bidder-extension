import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarPage from './SidebarPage';

// Prevent double render using a global flag
const RENDER_FLAG = '__LAZYBIDDER_SIDEBAR_RENDERED__';

// Check if already rendered
if (!(window as any)[RENDER_FLAG]) {
  (window as any)[RENDER_FLAG] = true;
  
  const container = document.getElementById('root');
  if (container) {
    console.log('SidebarPage - Initializing');
    const root = createRoot(container);
    root.render(<SidebarPage />);
  }
} else {
  console.log('SidebarPage - Already rendered, skipping');
}
