import React from 'react';
import { StatusPanelProps } from '../types/sidebar';

const StatusPanel: React.FC<StatusPanelProps> = ({ isActive, socketConnected }) => {
  return (
    <div className="sidebar-status">
      <div className="sidebar-status-item">
        <span className="sidebar-status-label">Status:</span>
        <span className={`sidebar-status-badge ${
          isActive 
            ? 'sidebar-status-active' 
            : 'sidebar-status-inactive'
        }`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      
      <div className="sidebar-status-item">
        <span className="sidebar-status-label">Backend:</span>
        <span className={`sidebar-status-badge ${
          socketConnected 
            ? 'sidebar-status-connected' 
            : 'sidebar-status-disconnected'
        }`}>
          {socketConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="sidebar-status-item">
        <span className="sidebar-status-label">Sync:</span>
        <span className={`sidebar-status-badge ${
          socketConnected 
            ? 'sidebar-status-synced' 
            : 'sidebar-status-not-synced'
        }`}>
          {socketConnected ? 'Synced' : 'Not Synced'}
        </span>
      </div>
    </div>
  );
};

export default StatusPanel;
