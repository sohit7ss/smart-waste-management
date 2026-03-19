import { FaTrashAlt, FaExclamationTriangle, FaAdjust, FaCheckCircle, FaRoute } from 'react-icons/fa';

export default function StatsCards({ dustbins, route }) {
  const total = dustbins.length;
  const overflowCount = dustbins.filter(b => b.status === 'full' || b.status === 'overflowing').length;
  const halfCount = dustbins.filter(b => b.status === 'half-full').length;
  const emptyCount = dustbins.filter(b => b.status === 'empty').length;
  const routeStops = route ? route.total_stops : 0;

  return (
    <div className="stats-row">
      <div className="stat-card total">
        <div className="stat-card-header">
          <span className="stat-card-label">Total Bins</span>
          <div className="stat-card-icon"><FaTrashAlt /></div>
        </div>
        <div className="stat-card-value">{total}</div>
        <div className="stat-card-desc">Monitored in real-time</div>
      </div>

      <div className="stat-card overflow">
        <div className="stat-card-header">
          <span className="stat-card-label">Critical</span>
          <div className="stat-card-icon"><FaExclamationTriangle /></div>
        </div>
        <div className="stat-card-value">{overflowCount}</div>
        <div className="stat-card-desc">Full or overflowing</div>
      </div>

      <div className="stat-card half">
        <div className="stat-card-header">
          <span className="stat-card-label">Half Full</span>
          <div className="stat-card-icon"><FaAdjust /></div>
        </div>
        <div className="stat-card-value">{halfCount}</div>
        <div className="stat-card-desc">Monitor closely</div>
      </div>

      <div className="stat-card empty-stat">
        <div className="stat-card-header">
          <span className="stat-card-label">Empty</span>
          <div className="stat-card-icon"><FaCheckCircle /></div>
        </div>
        <div className="stat-card-value">{emptyCount}</div>
        <div className="stat-card-desc">Recently collected</div>
      </div>

      <div className="stat-card route">
        <div className="stat-card-header">
          <span className="stat-card-label">Route Stops</span>
          <div className="stat-card-icon"><FaRoute /></div>
        </div>
        <div className="stat-card-value">{routeStops}</div>
        <div className="stat-card-desc">{route ? `${route.fuel_saved} fuel saved` : 'Calculating...'}</div>
      </div>
    </div>
  );
}
