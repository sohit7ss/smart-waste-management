import React, { useState, useEffect } from 'react';
import { routeAPI } from '../services/api';
import './TableStyles.css';

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await routeAPI.getAll();
      setRoutes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const optimizeNewRoute = async () => {
    try {
      await routeAPI.generate();
      fetchRoutes();
    } catch (err) {
      // Fallback to legacy optimize endpoint
      try {
        const api = (await import('../services/api')).default;
        await api.post('/routes/optimize');
        fetchRoutes();
      } catch (e) {
        alert(e.response?.data?.detail || 'Could not generate route');
      }
    }
  };

  const completeRoute = async (id) => {
    try {
      const api = (await import('../services/api')).default;
      await api.put(`/routes/${id}/status?status=completed`);
      fetchRoutes();
    } catch (err) {
      console.error(err);
      alert('Failed to complete route.');
    }
  };

  if (loading) return <div>Loading Routes...</div>;

  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title">🗺️ Route Optimization History</h2>
        <button className="btn-action" onClick={optimizeNewRoute} style={{ background: 'var(--accent-purple)' }}>
          Run AI Optimizer Now
        </button>
      </div>
      
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Route ID</th>
              <th>Van ID</th>
              <th>Stops Count</th>
              <th>Est. Time (mins)</th>
              <th>Fuel Saved (%)</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.map(rt => {
              const stopsArray = JSON.parse(rt.stops);
              return (
                <tr key={rt.id}>
                  <td>#{rt.id}</td>
                  <td>{rt.van_id}</td>
                  <td>{stopsArray.length} stops</td>
                  <td>{rt.estimated_time}</td>
                  <td className="text-green">+{rt.fuel_saved.toFixed(1)}%</td>
                  <td>
                    <span className={`status-badge ${rt.status}`}>
                      {rt.status}
                    </span>
                  </td>
                  <td>{new Date(rt.date).toLocaleDateString()}</td>
                  <td>
                    {rt.status !== 'completed' && (
                       <button className="btn-action resolve" onClick={() => completeRoute(rt.id)}>Mark Complete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
