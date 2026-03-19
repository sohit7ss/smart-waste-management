import { FaRoute, FaClock, FaGasPump, FaMapSigns } from 'react-icons/fa';

export default function RoutePanel({ route, showRoute, onToggleRoute }) {
  if (!route) return null;

  return (
    <div className="sidebar-panel">
      <div className="section-header">
        <div className="section-title">
          <FaRoute className="section-title-icon" />
          Optimized Route
        </div>
      </div>

      <div className="route-stats">
        <div className="route-stat-item">
          <div className="route-stat-value">{route.total_stops}</div>
          <div className="route-stat-label">Stops</div>
        </div>
        <div className="route-stat-item">
          <div className="route-stat-value">{route.estimated_time}</div>
          <div className="route-stat-label">Est. Time</div>
        </div>
        <div className="route-stat-item">
          <div className="route-stat-value">{route.fuel_saved}</div>
          <div className="route-stat-label">Fuel Saved</div>
        </div>
        <div className="route-stat-item">
          <div className="route-stat-value" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {route.generated_at}
          </div>
          <div className="route-stat-label">Generated</div>
        </div>
      </div>

      <button className="btn-route-toggle" onClick={onToggleRoute}>
        {showRoute ? '🗺️ Hide Route on Map' : '🗺️ Show Route on Map'}
      </button>

      <div className="route-stops">
        {route.route.map((stop, idx) => (
          <div className="route-stop" key={stop.id}>
            <div className="route-stop-number">{idx + 1}</div>
            <div className="route-stop-info">
              <div className="route-stop-name">{stop.location}</div>
              <div className="route-stop-status">{stop.status} — {stop.fill_level}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
