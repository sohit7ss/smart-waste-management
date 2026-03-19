/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useRef } from 'react';
import { dustbinAPI, alertAPI, complaintAPI, routeAPI } from '../services/api';
import StatsCards from '../components/StatsCards';
import MapView from '../components/MapView';
import RoutePanel from '../components/RoutePanel';
import ComplaintsList from '../components/ComplaintsList';
import AlertBanner from '../components/AlertBanner';

export default function Dashboard() {
  const [dustbins, setDustbins] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);

  const fetchDashboardData = async () => {
    try {
      const [binsRes, compRes, routeRes] = await Promise.all([
        dustbinAPI.getAll(),
        complaintAPI.getAll(),
        routeAPI.getToday(),
      ]);

      setDustbins(Array.isArray(binsRes.data) ? binsRes.data : binsRes.data?.dustbins || []);
      setComplaints(Array.isArray(compRes.data) ? compRes.data : []);

      if (routeRes.data && routeRes.data.length > 0) {
        const r = routeRes.data[0];
        setRouteData({
          ...r,
          stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setLoading(false);
    }
  };

  // WebSocket for live updates (Upgrade 1)
  useEffect(() => {
    let ws;
    const connectWs = () => {
      ws = new WebSocket('ws://localhost:8000/ws/dashboard');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected - live updates active!');
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dustbin_update' && data.dustbins) {
            setDustbins(data.dustbins);
          }
          if (data.type === 'truck_location_update' && data.truck) {
            // handled by MapView via its own WS subscription
          }
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      ws.onerror = () => {
        setWsStatus('error');
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Reconnect after 5 seconds
        setTimeout(connectWs, 5000);
      };
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Initial data fetch + fallback polling
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if(loading) return <div className="loading-spinner"><div className="spinner"></div><p>Loading System Intelligence...</p></div>;

  return (
    <div className="dashboard">
      {/* Live Alert Banner */}
      <AlertBanner />

      {/* WebSocket Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        fontSize: '11px',
        color: wsStatus === 'connected' ? '#22c55e' : '#f59e0b'
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: wsStatus === 'connected' ? '#22c55e' : '#f59e0b',
          animation: wsStatus === 'connected' ? 'pulse-dot 2s infinite' : 'none'
        }}/>
        {wsStatus === 'connected' ? 'LIVE' : 'RECONNECTING...'}
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>

      <div className="stats-row">
        <StatsCards dustbins={dustbins} routeData={routeData} />
      </div>

      <MapView 
        dustbins={dustbins} 
        routeData={showRouteMap ? routeData : null} 
      />

      <div className="sidebar">
        <div className="sidebar-panel">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-title-icon">🚚</span> Active Route
            </h2>
          </div>
          <RoutePanel 
            routeData={routeData} 
            showRouteMap={showRouteMap} 
            setShowRouteMap={setShowRouteMap} 
          />
        </div>

        <div className="sidebar-panel">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-title-icon">⚠️</span> Recent Alerts
            </h2>
          </div>
          <ComplaintsList complaints={complaints} />
        </div>
      </div>
    </div>
  );
}
