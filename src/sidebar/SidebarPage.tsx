import React from 'react';
import { useSidebarSocket } from '../hooks';
import './sidebar.css';

const SidebarPage: React.FC = () => {
  const { socketConnected, orderState } = useSidebarSocket();

  const orderStatusLabel = () => {
    switch (orderState.phase) {
      case 'idle':
        return 'No order';
      case 'running': {
        const n = orderState.jobsFound;
        return `Running (${n} job${n === 1 ? '' : 's'} found)`;
      }
      case 'stopped':
        return 'Stopped';
      case 'completed':
        return 'Completed';
    }
  };

  return (
    <div className="sidebar-container sidebar-main sidebar-slide-in flex flex-col h-full min-h-0">
      <div className="sidebar-header shrink-0">
        <h1 className="sidebar-header-title">LazyBidder</h1>
        <p className="sidebar-header-subtitle">Indeed scraper</p>
      </div>

      <div className="sidebar-tab-panel p-4 space-y-4">
        <div className="sidebar-status">
          <div className="sidebar-status-item">
            <span className="sidebar-status-label">Connection</span>
            <span
              className={`sidebar-status-badge ${
                socketConnected ? 'sidebar-status-connected' : 'sidebar-status-disconnected'
              }`}
            >
              {socketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="sidebar-status">
          <div className="sidebar-status-item">
            <span className="sidebar-status-label">Order</span>
            <span
              className={`sidebar-status-badge ${
                orderState.phase === 'running' || orderState.phase === 'completed'
                  ? 'sidebar-status-connected'
                  : 'sidebar-status-disconnected'
              }`}
            >
              {orderStatusLabel()}
            </span>
          </div>
          {orderState.phase === 'running' && orderState.jobsScraped > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Scraped {orderState.jobsScraped} of {orderState.jobsFound} jobs on this page
            </p>
          )}
          {orderState.error && (
            <p className="text-xs text-red-600 mt-2">{orderState.error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarPage;