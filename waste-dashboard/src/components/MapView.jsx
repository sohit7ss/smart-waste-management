import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const DELHI = [28.6139, 77.2090]

const BIN_COLORS = {
  empty: '#22c55e',
  'half-full': '#f59e0b',
  full: '#f97316',
  overflowing: '#ef4444',
}

const truckIcon = L.divIcon({
  className: '',
  html: `<div style="background:#3b82f6;border-radius:8px;padding:4px 8px;color:white;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🚛</div>`,
  iconSize: [40, 32],
  iconAnchor: [20, 16],
})

const complaintIcon = L.divIcon({
  className: '',
  html: `<div style="background:#f97316;border-radius:8px;padding:4px 8px;color:white;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">📍</div>`,
  iconSize: [40, 32],
  iconAnchor: [20, 16],
})

function FitBounds({ bins = [], trucks = [], complaints = [] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current) return
    const points = []
    bins.forEach(b => { if (b.lat && b.lng) points.push([b.lat, b.lng]) })
    trucks.forEach(t => { if (t.lat && t.lng) points.push([t.lat, t.lng]) })
    complaints.forEach(c => { if (c.lat && c.lng) points.push([c.lat, c.lng]) })
    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30] })
      fitted.current = true
    }
  }, [bins, trucks, complaints, map])

  return null
}

export default function MapView({ bins = [], trucks = [], complaints = [], routeLine = null }) {
  return (
    <MapContainer
      center={DELHI}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '12px', minHeight: '400px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />

      <FitBounds bins={bins} trucks={trucks} complaints={complaints} />

      {/* Bin markers — circle markers colored by status */}
      {bins.map(bin => (
        bin.lat && bin.lng ? (
          <CircleMarker
            key={`bin-${bin.id}`}
            center={[bin.lat, bin.lng]}
            radius={10}
            fillColor={BIN_COLORS[bin.status] || '#6b7280'}
            color="white"
            weight={2}
            fillOpacity={0.9}
          >
            <Popup>
              <div style={{ color: '#0f172a', minWidth: '180px' }}>
                <strong>🗑️ Bin #{bin.id}</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>📍 {bin.location}</div>
                <div style={{ fontSize: '13px' }}>
                  Status: <span style={{ color: BIN_COLORS[bin.status], fontWeight: 'bold' }}>{bin.status}</span>
                </div>
                <div style={{ fontSize: '13px' }}>Fill: {bin.fill_level}%</div>
                <div style={{ fontSize: '13px' }}>🔋 Battery: {bin.battery}%</div>
              </div>
            </Popup>
          </CircleMarker>
        ) : null
      ))}

      {/* Truck markers — blue truck icon */}
      {trucks.map(truck => (
        truck.lat && truck.lng ? (
          <Marker
            key={`truck-${truck.id}`}
            position={[truck.lat, truck.lng]}
            icon={truckIcon}
          >
            <Popup>
              <div style={{ color: '#0f172a', minWidth: '180px' }}>
                <strong>🚛 {truck.id}</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>👤 {truck.driver}</div>
                <div style={{ fontSize: '13px' }}>📞 {truck.phone}</div>
                <div style={{ fontSize: '13px' }}>
                  Status: <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{truck.status?.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: '13px' }}>🚀 {truck.speed} km/h</div>
              </div>
            </Popup>
          </Marker>
        ) : null
      ))}

      {/* Complaint markers — orange pin icon */}
      {complaints.filter(c => c.status !== 'resolved' && c.lat && c.lng).map(comp => (
          <Marker
            key={`comp-${comp.id}`}
            position={[comp.lat, comp.lng]}
            icon={complaintIcon}
          >
            <Popup>
              <div style={{ color: '#0f172a', minWidth: '180px' }}>
                <strong>📍 Complaint #{comp.id}</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>📍 {comp.location}</div>
                <div style={{ fontSize: '13px' }}>{comp.description}</div>
                <div style={{ fontSize: '13px' }}>
                  Status: <span style={{ color: '#f97316', fontWeight: 'bold' }}>{comp.status}</span>
                </div>
                <div style={{ fontSize: '13px' }}>Priority: {comp.priority}</div>
              </div>
            </Popup>
          </Marker>
      ))}

      {/* Route polyline */}
      {routeLine}
    </MapContainer>
  )
}
