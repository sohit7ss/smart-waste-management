import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await api.get('/alerts/');
        setAlertCount(res.data.total || 0);
      } catch {
        // Silently fail
      }
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/',             icon: '🏠', label: 'Dashboard',  show: true },
    { path: '/dustbins',     icon: '🗑️', label: 'Dustbins',   show: isAdmin },
    { path: '/segregation',  icon: '♻️', label: 'Segregation', show: true },
    { path: '/complaints',   icon: '📍', label: 'Complaints',  show: true },
    { path: '/routes',       icon: '🗺️', label: 'Routes',      show: true },
    { path: '/fleet',        icon: '🚛', label: 'Fleet Tracker', show: true },
    { path: '/alerts',       icon: '🔔', label: 'Alerts',      show: true, badge: alertCount },
    { path: '/driver',       icon: '👤', label: 'Driver View',  show: true },
    { path: '/analytics',    icon: '📊', label: 'Analytics',    show: isAdmin },
  ];

  return (
    <aside className="sidebar-container">
      <nav className="sidebar-nav">
        {navItems.filter(n => n.show).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            <span className="nav-icon" style={{ fontSize: '18px' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span style={{
                background: '#ef4444',
                color: 'white',
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginLeft: 'auto',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
          <div className="user-details">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
