import React from 'react';
import { HeaderProps } from '../types/sidebar';

const Header: React.FC<HeaderProps> = ({ userName }) => {
  return (
    <div className="sidebar-header">
      <h1 className="sidebar-header-title">LazyBidder</h1>
      <p className="sidebar-header-subtitle">Welcome, {userName}</p>
    </div>
  );
};

export default Header;
