import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/alerts/');
        setAlerts(res.data.alerts || []);
      } catch (err) {
        // Silently fail — alerts are supplementary
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  const critical = alerts.filter(a => a.severity === 'critical');
  const displayAlerts = critical.length > 0 ? critical : alerts;

  return (
    <div className="alert-banner" style={{
      background: critical.length > 0 
        ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
        : 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: 'white',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      fontWeight: '500',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      animation: critical.length > 0 ? 'pulse-banner 2s infinite' : 'none',
      position: 'relative',
      zIndex: 100
    }}>
      <span style={{ fontSize: '18px' }}>🚨</span>
      <span><strong>{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</strong></span>
      <span style={{ opacity: 0.6 }}>|</span>
      {displayAlerts.slice(0, 2).map(a => (
        <span key={a.id} style={{ opacity: 0.9 }}>{a.message}</span>
      ))}
      
      <style>{`
        @keyframes pulse-banner {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
