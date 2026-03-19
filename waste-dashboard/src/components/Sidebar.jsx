import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiTrash2, FiMessageSquare, FiTrendingUp, FiMap, FiLogOut, FiAlertTriangle, FiTruck } from 'react-icons/fi';
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

  return (
    <aside className="sidebar-container">
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiHome className="nav-icon" />
          <span>Dashboard</span>
        </NavLink>
        
        {isAdmin && (
          <NavLink to="/dustbins" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <FiTrash2 className="nav-icon" />
            <span>Dustbins</span>
          </NavLink>
        )}
        
        <NavLink to="/complaints" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiMessageSquare className="nav-icon" />
          <span>Complaints</span>
        </NavLink>
        
        <NavLink to="/routes" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiMap className="nav-icon" />
          <span>Route Optimization</span>
        </NavLink>

        {/* Alerts Nav with Badge */}
        <NavLink to="/alerts" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiAlertTriangle className="nav-icon" />
          <span>Alerts</span>
          {alertCount > 0 && (
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
              {alertCount}
            </span>
          )}
        </NavLink>

        {/* Driver View */}
        <NavLink to="/driver" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiTruck className="nav-icon" />
          <span>Driver View</span>
        </NavLink>

        {/* Fleet Tracker */}
        <NavLink to="/fleet" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <FiTruck className="nav-icon" style={{color: '#3b82f6'}}/>
          <span>Fleet Tracker</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/analytics" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <FiTrendingUp className="nav-icon" />
            <span>Analytics</span>
          </NavLink>
        )}
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
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
