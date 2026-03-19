import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useState, useEffect } from 'react'
import api from '../services/api'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// ---- Icon Factories ----
const createBinIcon = (status, isOverflowing) => {
  const colors = {
    'empty':       '#22c55e',
    'half-full':   '#f59e0b',
    'full':        '#f97316',
    'overflowing': '#ef4444',
    'offline':     '#6b7280'
  }
  const color = colors[status] || '#6b7280'
  const pulseStyle = isOverflowing
    ? 'animation: binPulse 1.5s infinite ease-in-out;'
    : ''

  return L.divIcon({
    className: '',
    html: `
      <style>@keyframes binPulse {
        0%,100% { transform: rotate(-45deg) scale(1); opacity:1; }
        50% { transform: rotate(-45deg) scale(1.25); opacity:0.75; }
      }</style>
      <div style="
        width:30px; height:30px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:0 2px 10px rgba(0,0,0,0.5);
        ${pulseStyle}
      ">
        <span style="transform:rotate(45deg);display:block;text-align:center;font-size:14px;line-height:24px;">🗑</span>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -34]
  })
}

const createComplaintIcon = (resolved) => L.divIcon({
  className: '',
  html: `<div style="font-size:26px;filter:${resolved ? 'grayscale(100%) opacity(0.6)' : 'none'};drop-shadow(0 2px 4px rgba(0,0,0,0.4))">📍</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

const createTruckIcon = () => L.divIcon({
  className: '',
  html: `<div style="background:#3b82f6;border-radius:8px;padding:4px 8px;color:white;font-size:18px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🚛</div>`,
  iconSize: [42, 32],
  iconAnchor: [21, 16],
})

// ---- Helper ----
const getFillColor = (level) => {
  if (level >= 90) return '#ef4444'
  if (level >= 60) return '#f97316'
  if (level >= 30) return '#f59e0b'
  return '#22c55e'
}

const getWasteColor = (type) => {
  const c = { dry: '#f59e0b', wet: '#22c55e', hazardous: '#ef4444', recyclable: '#3b82f6' }
  return c[type] || '#94a3b8'
}

export default function LiveMap({ dustbins = [], routeData = null }) {
  const [complaints, setComplaints] = useState([])
  const [trucks, setTrucks] = useState([])
  const [showBins, setShowBins] = useState(true)
  const [showComplaints, setShowComplaints] = useState(true)
  const [showTrucks, setShowTrucks] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)

  useEffect(() => {
    // Fetch complaints
    api.get('/complaints/').then(res => {
      setComplaints(res.data || [])
    }).catch(() => {})

    // Fetch trucks
    api.get('/fleet/trucks').then(res => {
      setTrucks(res.data.trucks || [])
    }).catch(() => {})

    // WebSocket for real-time truck updates
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard')
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'truck_location_update') {
          setTrucks(prev => prev.map(t => t.id === data.truck.id ? { ...t, ...data.truck } : t))
        }
      } catch {}
    }
    ws.onerror = () => {}
    return () => { try { ws.close() } catch {} }
  }, [])

  // Build hotspots from dustbin data
  const hotspots = dustbins
    .filter(b => b.fill_level >= 70)
    .map(b => ({ lat: b.lat, lng: b.lng, severity: Math.min(10, Math.floor(b.fill_level / 10)) }))

  // Build route polyline path
  const routePath = routeData?.stops
    ? routeData.stops.map(id => {
        const bin = dustbins.find(b => b.id === id)
        return bin ? [bin.lat, bin.lng] : null
      }).filter(Boolean)
    : []

  const LAYERS = [
    { key: 'bins',       label: '🗑 Dustbins',   state: showBins,       toggle: setShowBins },
    { key: 'complaints', label: '📍 Complaints',  state: showComplaints, toggle: setShowComplaints },
    { key: 'trucks',     label: '🚛 Trucks',      state: showTrucks,     toggle: setShowTrucks },
    { key: 'heatmap',   label: '🔥 Hotspots',    state: showHeatmap,    toggle: setShowHeatmap },
  ]

  const LEGEND = [
    { color: '#22c55e', label: 'Empty (0–30%)' },
    { color: '#f59e0b', label: 'Half Full (30–60%)' },
    { color: '#f97316', label: 'Full (60–90%)' },
    { color: '#ef4444', label: 'Overflowing (90–100%)' },
  ]

  return (
    <div className="map-section">
      <div className="section-header">
        <div className="section-title">
          <span style={{ marginRight: 8 }}>📍</span> Live City Monitoring
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {dustbins.length} bins • {trucks.length} trucks
        </span>
      </div>

      <div className="map-container" style={{ position: 'relative' }}>
        {/* Layer Toggle Panel */}
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: 'rgba(15,23,42,0.92)', borderRadius: 12, padding: 12,
          border: '1px solid #334155', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          minWidth: 150
        }}>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>
            Map Layers
          </div>
          {LAYERS.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'white', fontSize: 13, marginBottom: 4 }}>
              <input type="checkbox" checked={item.state} onChange={() => item.toggle(!item.state)} style={{ cursor: 'pointer' }} />
              {item.label}
            </label>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 40, left: 10, zIndex: 1000,
          background: 'rgba(15,23,42,0.92)', borderRadius: 12, padding: '10px 14px',
          border: '1px solid #334155', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 }}>Fill Level</div>
          {LEGEND.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
              <span style={{ color: 'white', fontSize: 12 }}>{item.label}</span>
            </div>
          ))}
        </div>

        <MapContainer
          center={[28.6180, 77.2120]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Dustbin Markers */}
          {showBins && dustbins.map(bin => (
            <Marker
              key={bin.id}
              position={[bin.lat, bin.lng]}
              icon={createBinIcon(bin.status, bin.fill_level >= 90)}
            >
              <Popup minWidth={270}>
                <div style={{ background: '#1e293b', color: 'white', borderRadius: 8, padding: 14, minWidth: 250 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 16, color: '#22c55e', marginBottom: 6 }}>🗑️ Bin #{bin.id}</div>
                  <div style={{ marginBottom: 4, fontSize: 13 }}>📍 {bin.location}</div>

                  {/* Fill level bar */}
                  <div style={{ margin: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span>Fill Level</span>
                      <span style={{ color: getFillColor(bin.fill_level), fontWeight: 'bold' }}>{bin.fill_level}%</span>
                    </div>
                    <div style={{ background: '#334155', borderRadius: 999, height: 8 }}>
                      <div style={{ background: getFillColor(bin.fill_level), width: `${bin.fill_level}%`, height: '100%', borderRadius: 999 }} />
                    </div>
                  </div>

                  {/* Waste type */}
                  <div style={{ marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: '#94a3b8' }}>Waste Type: </span>
                    <span style={{
                      background: getWasteColor(bin.waste_type) + '30', color: getWasteColor(bin.waste_type),
                      padding: '2px 8px', borderRadius: 999, fontSize: 12, marginLeft: 4
                    }}>{bin.waste_type || 'Mixed'}</span>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                    <span>🔋 Battery: {bin.battery || 100}%</span>
                    <span>📡 Signal: Strong</span>
                    <span>Status: <span style={{ color: getFillColor(bin.fill_level), fontWeight: 'bold', textTransform: 'uppercase' }}>{bin.status}</span></span>
                    <span>🕐 {bin.last_updated ? new Date(bin.last_updated).toLocaleTimeString() : 'Just now'}</span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`http://localhost:8000/dustbins/${bin.id}/qr`) }}
                      style={{ flex: 1, background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 6, padding: 6, cursor: 'pointer', fontSize: 11 }}
                    >QR Code</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open('http://localhost:5174') }}
                      style={{ flex: 1, background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, padding: 6, cursor: 'pointer', fontSize: 11 }}
                    >Report Issue</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Complaint Markers */}
          {showComplaints && complaints.map(complaint => (
            complaint.lat && complaint.lng && (
              <Marker
                key={`c-${complaint.id}`}
                position={[complaint.lat, complaint.lng]}
                icon={createComplaintIcon(complaint.status === 'resolved')}
              >
                <Popup>
                  <div style={{ background: '#1e293b', color: 'white', padding: 12, borderRadius: 8, minWidth: 200 }}>
                    <div style={{ fontWeight: 'bold', color: complaint.status === 'resolved' ? '#22c55e' : '#f59e0b', marginBottom: 6 }}>
                      📍 Complaint #{complaint.id}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{complaint.description}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Priority: {complaint.priority}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Status: <strong>{complaint.status}</strong></div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {/* Truck Markers */}
          {showTrucks && trucks.map(truck => (
            truck.lat && truck.lng && (
              <Marker
                key={`t-${truck.id}`}
                position={[truck.lat, truck.lng]}
                icon={createTruckIcon()}
              >
                <Popup>
                  <div style={{ background: '#1e293b', color: 'white', padding: 12, borderRadius: 8, minWidth: 200 }}>
                    <strong style={{ color: '#3b82f6', display: 'block', marginBottom: 6 }}>🚛 {truck.van_id}</strong>
                    <div style={{ fontSize: 13 }}>👤 {truck.driver_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>🚀 {truck.speed} km/h</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Status: {truck.status}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>⛽ Fuel: {truck.fuel_level}%</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>📍 {truck.completed_stops}/{truck.total_stops} stops</div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {/* Hotspot Heatmap Circles */}
          {showHeatmap && hotspots.map((spot, i) => (
            <Circle
              key={i}
              center={[spot.lat, spot.lng]}
              radius={spot.severity * 80}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.18, weight: 1 }}
            />
          ))}

          {/* Optimized Route Polyline */}
          {routePath.length > 1 && (
            <Polyline
              positions={routePath}
              pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8, dashArray: '12, 8' }}
            />
          )}
        </MapContainer>
      </div>

      <div className="map-legend">
        {LEGEND.map(item => (
          <div key={item.label} className="legend-item">
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, display: 'inline-block', marginRight: 4 }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}
