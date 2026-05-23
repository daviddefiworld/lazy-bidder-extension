import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarPage from './SidebarPage';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidebarPage />);
} else {
  console.error('LazyBidder sidebar: #root not found');
}
