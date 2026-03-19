import { useState, useEffect } from 'react';
import api from '../services/api';

export default function DriverView() {
  const [route, setRoute] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState({});

  useEffect(() => {
    fetchRoute();
  }, []);

  const fetchRoute = async () => {
    try {
      const res = await api.get('/routes/optimized');
      setRoute(res.data.route || []);
      setRouteInfo({
        total_distance_km: res.data.total_distance_km,
        estimated_time_mins: res.data.estimated_time_mins,
        fuel_saved_percent: res.data.fuel_saved_percent,
        co2_saved_kg: res.data.co2_saved_kg,
        algorithm: res.data.algorithm
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markCollected = (binId) => {
    if (!completed.find(c => c.id === binId)) {
      setCompleted([...completed, { id: binId, time: new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}) }]);
    }
  };

  const progress = route.length > 0
    ? (completed.length / route.length) * 100
    : 0;

  const remainingStops = route.length - completed.length;
  const estimatedTimeLeft = routeInfo.estimated_time_mins 
    ? Math.round((routeInfo.estimated_time_mins / route.length) * remainingStops)
    : 0;

  return (
    <div style={{
      maxWidth: '520px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: '#0f172a',
      minHeight: '100vh',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#22c55e', margin: 0, fontSize: '24px' }}>🚛 Driver Route</h2>
        <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>
          {routeInfo.algorithm || 'AI-Optimized'} • {routeInfo.total_distance_km || 0} km
        </p>
      </div>

      {/* Progress Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
          <span style={{ color: '#94a3b8' }}>Collection Progress</span>
          <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{completed.length}/{route.length} stops</span>
        </div>
        <div style={{ background: '#334155', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            width: `${progress}%`,
            height: '100%',
            borderRadius: '999px',
            transition: 'width 0.5s ease'
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
          <span>⏱ ~{estimatedTimeLeft} mins left</span>
          <span>⛽ {routeInfo.fuel_saved_percent || 0}% fuel saved</span>
        </div>
      </div>

      {/* Route Stops */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8' }}>Loading optimized route...</p>
      ) : route.length === 0 ? (
        <div style={{
          background: '#1e293b',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid #334155'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h3 style={{ color: '#22c55e' }}>No Priority Bins</h3>
          <p style={{ color: '#94a3b8' }}>All bins are below critical levels. Check back later!</p>
        </div>
      ) : (
        route.map((bin, index) => {
          const isDone = completed.find(c => c.id === bin.id);
          return (
          <div key={bin.id} style={{
            background: isDone ? '#14532d' : '#1e293b',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '12px',
            border: isDone
              ? '1px solid #22c55e'
              : '1px solid #334155',
            opacity: isDone ? 0.6 : 1,
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                  <span style={{
                    background: '#334155',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    marginRight: '8px',
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>#{index + 1}</span>
                  {bin.location}
                </div>
                <div style={{
                  color: bin.status === 'overflowing' ? '#ef4444' : '#f59e0b',
                  fontSize: '13px',
                  marginTop: '6px'
                }}>
                  {bin.fill_level}% full • <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{bin.status}</span>
                </div>
                {isDone && (
                  <div style={{ fontSize: '12px', color: '#86efac', marginTop: '4px' }}>
                    Collected at {isDone.time}
                  </div>
                )}
              </div>
              <button
                onClick={() => !isDone && markCollected(bin.id)}
                disabled={!!isDone}
                style={{
                  background: isDone ? '#334155' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: isDone ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  cursor: isDone ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  transition: 'transform 0.2s'
                }}
              >
                {isDone ? '✓ Collected' : '✓ Done'}
              </button>
            </div>
          </div>
        )})
      )}

      {/* Completion Banner */}
      {completed.length === route.length && route.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #14532d, #166534)',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          border: '2px solid #22c55e',
          marginTop: '20px'
        }}>
          <div style={{ fontSize: '56px', marginBottom: '8px' }}>🎉</div>
          <h3 style={{ color: '#22c55e', margin: '0 0 8px', fontSize: '22px' }}>Route Complete!</h3>
          <p style={{ color: '#86efac', margin: 0 }}>All {route.length} bins collected • {routeInfo.co2_saved_kg || 0} kg CO₂ saved</p>
        </div>
      )}
    </div>
  );
}
