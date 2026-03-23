/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useRef } from 'react';
import { dustbinAPI, complaintAPI, routeAPI } from '../services/api';
import axios from 'axios';
import StatsCards from '../components/StatsCards';
import MapView from '../components/MapView';
import RoutePanel from '../components/RoutePanel';
import ComplaintsList from '../components/ComplaintsList';
import AlertBanner from '../components/AlertBanner';

export default function Dashboard() {
  const [dustbins, setDustbins] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [binsRes, compRes, routeRes, truckRes] = await Promise.all([
        dustbinAPI.getAll(),
        complaintAPI.getAll(),
        routeAPI.getToday(),
        axios.get('http://localhost:8000/fleet/trucks', { headers }).catch(() => ({ data: { trucks: [] } })),
      ]);

      setDustbins(Array.isArray(binsRes.data) ? binsRes.data : binsRes.data?.dustbins || []);
      setComplaints(Array.isArray(compRes.data) ? compRes.data : compRes.data?.complaints || []);
      setTrucks(truckRes.data?.trucks || []);

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

  // WebSocket for live updates
  useEffect(() => {
    let ws;
    const connectWs = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/dashboard');
        wsRef.current = ws;

        ws.onopen = () => {
          setWsStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'bin_update' && data.bin) {
              setDustbins(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(b => b.id === data.bin.id);
                if (idx >= 0) updated[idx] = { ...updated[idx], ...data.bin };
                else updated.push(data.bin);
                return updated;
              });
            }

            if (data.type === 'truck_update' && data.truck) {
              setTrucks(prev => prev.map(t =>
                t.id === data.truck.id ? { ...t, ...data.truck } : t
              ));
            }

            if (data.type === 'truck_dispatched' && data.notification) {
              setTrucks(prev => prev.map(t =>
                t.id === data.notification.truck_id
                  ? { ...t, status: 'on_route', assigned_bin: data.notification.bin_id }
                  : t
              ));
            }

            if (data.type === 'new_complaint' && data.complaint) {
              setComplaints(prev => [data.complaint, ...prev]);
            }

            if (data.type === 'complaint_update' && data.complaint) {
              setComplaints(prev => prev.map(c => 
                (c.id === data.complaint.id || c.firestore_id === data.complaint.firestore_id)
                  ? { ...c, ...data.complaint }
                  : c
              ));
            }
          } catch (e) { console.error("WS Parse Error:", e) }
        };

        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => {
          setWsStatus('disconnected');
          setTimeout(connectWs, 5000);
        };
      } catch {}
    };

    connectWs();
    return () => { try { wsRef.current?.close() } catch {} };
  }, []);

  // Initial data fetch + polling
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Loading System Intelligence...</p>
    </div>
  );

  return (
    <div className="dashboard">
      <AlertBanner />

      {/* WebSocket Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', fontSize: '11px',
        color: wsStatus === 'connected' ? '#22c55e' : '#f59e0b'
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: wsStatus === 'connected' ? '#22c55e' : '#f59e0b',
          animation: wsStatus === 'connected' ? 'pulse-dot 2s infinite' : 'none'
        }}/>
        {wsStatus === 'connected' ? 'LIVE' : 'RECONNECTING...'}
        <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>

      <div className="stats-row">
        <StatsCards dustbins={dustbins} routeData={routeData} />
      </div>

      <MapView
        bins={dustbins}
        trucks={trucks}
        complaints={complaints}
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
