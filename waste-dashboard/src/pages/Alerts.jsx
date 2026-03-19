import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './TableStyles.css';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0 });
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts/');
      setAlerts(res.data.alerts || []);
      setStats({
        total: res.data.total || 0,
        critical: res.data.critical || 0,
        high: res.data.high || 0,
        medium: res.data.medium || 0
      });
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const resolveAlert = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      fetchAlerts();
    } catch (err) {
      alert('Failed to resolve alert.');
    }
  };

  const severityStyle = {
    critical: { background: '#dc2626', color: 'white' },
    high: { background: '#f59e0b', color: '#1e1e1e' },
    medium: { background: '#3b82f6', color: 'white' }
  };

  if (loading) return <div>Loading Alerts...</div>;

  return (
    <div className="page-container">
      <div className="section-header">
        <h2 className="section-title">🚨 Alert Management Center</h2>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>{stats.total}</div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Total Active</div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', textAlign: 'center', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>{stats.critical}</div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Critical</div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.high}</div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>High</div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.medium}</div>
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Medium</div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Type</th>
              <th>Message</th>
              <th>Bin ID</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#22c55e' }}>✅ No active alerts — all systems normal!</td></tr>
            ) : (
              alerts.map(alert => (
                <tr key={alert.id}>
                  <td>
                    <span style={{
                      ...severityStyle[alert.severity],
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {alert.severity}
                    </span>
                  </td>
                  <td>{alert.type}</td>
                  <td style={{ maxWidth: '400px' }}>{alert.message}</td>
                  <td>#{alert.dustbin_id}</td>
                  <td>{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : '-'}</td>
                  <td>
                    <button className="btn-action resolve" onClick={() => resolveAlert(alert.id)}>
                      Resolve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
