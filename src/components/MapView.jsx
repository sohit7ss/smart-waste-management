import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

// Create colored circular markers using SVG
function createIcon(color, glowColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.9"/>
      <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
    </svg>`;
  return L.divIcon({
    html: `<div style="filter: drop-shadow(0 0 6px ${glowColor});">${svg}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

const icons = {
  empty: createIcon('#10b981', 'rgba(16,185,129,0.5)'),
  'half-full': createIcon('#f59e0b', 'rgba(245,158,11,0.5)'),
  full: createIcon('#ef4444', 'rgba(239,68,68,0.5)'),
  overflowing: createIcon('#ef4444', 'rgba(239,68,68,0.7)'),
};

function getBarColor(status) {
  switch (status) {
    case 'empty': return '#10b981';
    case 'half-full': return '#f59e0b';
    case 'full': return '#ef4444';
    case 'overflowing': return '#ef4444';
    default: return '#64748b';
  }
}

export default function MapView({ dustbins, route, showRoute }) {
  const center = [28.6180, 77.2120];
  const routeCoords = showRoute && route?.route
    ? route.route.map(b => [b.lat, b.lng])
    : [];

  return (
    <div className="map-section">
      <div className="section-header">
        <div className="section-title">
          <FaMapMarkerAlt className="section-title-icon" />
          Live Dustbin Monitoring
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {dustbins.length} bins tracked
        </span>
      </div>

      <div className="map-container">
        <MapContainer
          center={center}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {dustbins.map((bin) => (
            <Marker
              key={bin.id}
              position={[bin.lat, bin.lng]}
              icon={icons[bin.status] || icons['empty']}
            >
              <Popup>
                <div className="popup-title">{bin.location}</div>
                <span className={`popup-status ${bin.status}`}>{bin.status}</span>
                <div className="popup-fill">
                  Fill Level: {bin.fill_level}%
                  <div className="popup-fill-bar">
                    <div
                      className="popup-fill-bar-inner"
                      style={{
                        width: `${bin.fill_level}%`,
                        background: getBarColor(bin.status),
                      }}
                    />
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {showRoute && routeCoords.length > 1 && (
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: '#8b5cf6',
                weight: 4,
                opacity: 0.8,
                dashArray: '12, 8',
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot green"></span> Empty
        </div>
        <div className="legend-item">
          <span className="legend-dot yellow"></span> Half-Full
        </div>
        <div className="legend-item">
          <span className="legend-dot red"></span> Full / Overflow
        </div>
        {showRoute && (
          <div className="legend-item">
            <span style={{ width: 20, height: 3, background: '#8b5cf6', borderRadius: 2, display: 'inline-block' }}></span>
            Optimized Route
          </div>
        )}
      </div>
    </div>
  );
}
