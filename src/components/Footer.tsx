import React from 'react';
import { FooterProps } from '../types/sidebar';

const Footer: React.FC<FooterProps> = ({ onLogout }) => {
  return (
    <div className="sidebar-footer">
      <button
        onClick={onLogout}
        className="sidebar-footer-button"
      >
        Logout
      </button>
    </div>
  );
};

export default Footer;
