import React from 'react';
import { ControlPanelProps } from '../types/sidebar';

const ControlPanel: React.FC<ControlPanelProps> = ({ isActive, onToggle }) => {
  return (
    <div className="sidebar-control">
      <button
        onClick={onToggle}
        className={`sidebar-control-button ${
          isActive
            ? 'sidebar-control-button-active'
            : 'sidebar-control-button-inactive'
        }`}
      >
        {isActive ? 'Deactivate Extension' : 'Activate Extension'}
      </button>
    </div>
  );
};

export default ControlPanel;
