import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { fleetAPI } from '../services/api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const STATUS_COLOR = {
  idle: '#6b7280',
  on_route: '#3b82f6',
  collecting: '#f59e0b',
  returning: '#22c55e'
}

const STATUS_EMOJI = {
  idle: '⏸️',
  on_route: '🚛',
  collecting: '♻️',
  returning: '🏠'
}

const createTruckIcon = (status) => {
  const color = STATUS_COLOR[status] || '#6b7280'
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      border-radius: 8px;
      padding: 6px 10px;
      color: white;
      font-size: 20px;
      border: 2px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      white-space: nowrap;
    ">🚛</div>`,
    iconSize: [52, 38],
    iconAnchor: [26, 19],
  })
}

export default function FleetTracker() {
  const [trucks, setTrucks] = useState([])
  const [selectedTruck, setSelectedTruck] = useState(null)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({ total: 0, active: 0, idle: 0 })

  useEffect(() => {
    fetchTrucks()

    // Real-time WebSocket updates for truck positions
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

    const interval = setInterval(fetchTrucks, 15000)
    return () => {
      clearInterval(interval)
      try { ws.close() } catch {}
    }
  }, [])

  const fetchTrucks = async () => {
    try {
      const res = await fleetAPI.getAllTrucks()
      setTrucks(res.data.trucks || [])
      setStats({ total: res.data.total, active: res.data.active, idle: res.data.idle })
    } catch (err) {
      console.error('Fleet fetch error:', err)
    }
  }

  const filteredTrucks = trucks.filter(t => filter === 'all' || t.status === filter)

  return (
    <div style={{ padding: '24px', color: 'white', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>🚛 Fleet GPS Tracker</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>Live truck positions & status</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'on_route', 'collecting', 'idle'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? '#22c55e' : '#1e293b',
                color: 'white',
                border: `1px solid ${filter === f ? '#22c55e' : '#334155'}`,
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              {f === 'all' ? 'All Trucks' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Fleet', value: stats.total, color: '#3b82f6', emoji: '🚛' },
          { label: 'On Route', value: trucks.filter(t => t.status === 'on_route').length, color: '#3b82f6', emoji: '🛣️' },
          { label: 'Collecting', value: trucks.filter(t => t.status === 'collecting').length, color: '#f59e0b', emoji: '♻️' },
          { label: 'Idle', value: stats.idle, color: '#6b7280', emoji: '⏸️' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${stat.color}33`,
            borderLeft: `4px solid ${stat.color}`
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{stat.emoji}</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Map + Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* Map */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', height: '520px' }}>
          <MapContainer
            center={[28.6139, 77.2090]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {filteredTrucks.map(truck => (
              truck.lat && truck.lng && (
                <Marker
                  key={truck.id}
                  position={[truck.lat, truck.lng]}
                  icon={createTruckIcon(truck.status)}
                  eventHandlers={{ click: () => setSelectedTruck(truck) }}
                >
                  <Popup>
                    <div style={{ background: '#1e293b', color: 'white', padding: '12px', borderRadius: '8px', minWidth: '200px' }}>
                      <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '6px' }}>🚛 {truck.van_id}</strong>
                      <div style={{ fontSize: '13px', marginBottom: '3px' }}>👤 {truck.driver_name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>📞 {truck.driver_phone}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>🚀 {truck.speed} km/h</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {truck.completed_stops}/{truck.total_stops} stops</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>⛽ {truck.fuel_level}%</div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>

        {/* Truck Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
          {filteredTrucks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#1e293b', borderRadius: '12px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🚛</div>
              <p>No trucks match this filter</p>
            </div>
          )}
          {filteredTrucks.map(truck => (
            <div
              key={truck.id}
              onClick={() => setSelectedTruck(truck)}
              style={{
                background: selectedTruck?.id === truck.id ? '#1e3a5f' : '#1e293b',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                border: `1px solid ${selectedTruck?.id === truck.id ? '#3b82f6' : '#334155'}`,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>🚛 {truck.van_id}</span>
                <span style={{
                  background: (STATUS_COLOR[truck.status] || '#6b7280') + '22',
                  color: STATUS_COLOR[truck.status] || '#6b7280',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  {STATUS_EMOJI[truck.status]} {truck.status?.replace('_', ' ')}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                👤 {truck.driver_name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                📞 {truck.driver_phone}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>🚀 {truck.speed} km/h</span>
                <span>📍 {truck.completed_stops}/{truck.total_stops} stops</span>
              </div>

              {/* Fuel Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                  <span>⛽ Fuel</span>
                  <span style={{ color: truck.fuel_level < 30 ? '#ef4444' : '#22c55e' }}>{truck.fuel_level}%</span>
                </div>
                <div style={{ background: '#334155', borderRadius: '999px', height: '6px' }}>
                  <div style={{
                    background: truck.fuel_level < 30 ? '#ef4444' : '#22c55e',
                    width: `${truck.fuel_level}%`,
                    height: '100%',
                    borderRadius: '999px',
                    transition: 'width 0.5s'
                  }} />
                </div>
              </div>

              {truck.last_updated && (
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
                  Updated: {new Date(truck.last_updated).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
