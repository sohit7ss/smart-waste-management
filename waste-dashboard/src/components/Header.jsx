import React from 'react';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <span>♻️</span>
        </div>
        <div>
          <h1 className="header-title">SmartWaste V2</h1>
          <p className="header-subtitle">Intelligent Utility Management System</p>
        </div>
      </div>
      <div className="header-right">
        <div className="header-badge">
          <div className="pulse-dot"></div>
          SYSTEM ONLINE
        </div>
        <div className="header-team">
          Algorithmic Thunder Squad
        </div>
      </div>
    </header>
  );
}
