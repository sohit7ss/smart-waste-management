import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MapView from '../components/MapView'
import { fleetAPI } from '../services/api'
import axios from 'axios'
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
  const [trucks, setTrucks]             = useState([])
  const [selectedTruck, setSelectedTruck] = useState(null)
  const [filter, setFilter]             = useState('all')
  const [stats, setStats]               = useState({ total: 0, active: 0, idle: 0 })
  const [performance, setPerformance]   = useState(null)
  const [dustbins, setDustbins]         = useState([])
  const [trucksLoaded, setTrucksLoaded] = useState(false)

  // Dispatch modal state
  const [dispatchModal, setDispatchModal]     = useState(false)
  const [dispatchTruckId, setDispatchTruckId] = useState(null)
  const [dispatchBinId, setDispatchBinId]     = useState('')

  useEffect(() => {
    fetchTrucks()
    fetchPerformance()
    fetchDustbins()

    // Real-time WebSocket updates
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/dashboard`)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'truck_update' && data.truck) {
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
      setStats({ total: res.data.total || 0, active: res.data.active || 0, idle: res.data.idle || 0 })
      setTrucksLoaded(true)
    } catch (err) {
      console.error('Fleet fetch error:', err)
    }
  }

  const resetDemoData = async () => {
    try {
      await axios.post(`http://${window.location.hostname}:8000/fleet/reset-demo`)
      await fetchTrucks()
      alert('✅ Fleet demo data reloaded!')
    } catch {
      alert('❌ Failed to reset demo data')
    }
  }

  const fetchPerformance = async () => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8000/fleet/performance`)
      setPerformance(res.data)
    } catch {}
  }

  const fetchDustbins = async () => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8000/dustbins/`)
      setDustbins(Array.isArray(res.data) ? res.data : [])
    } catch {}
  }

  const handleDispatch = async () => {
    try {
      const res = await axios.post(`http://${window.location.hostname}:8000/fleet/dispatch`, {
        truck_id: dispatchTruckId,
        bin_id:   parseInt(dispatchBinId),
        reason:   'manual_dispatch'
      })
      alert(`✅ ${res.data.message}`)
      setDispatchModal(false)
      setDispatchBinId('')
      fetchTrucks()
    } catch {
      alert('❌ Dispatch failed!')
    }
  }

  const filteredTrucks = trucks.filter(t => filter === 'all' || t.status === filter)

  return (
    <div style={{ padding: '24px', color: 'white', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>🚛 Fleet GPS Tracker</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>Live truck positions, dispatch & performance</p>
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
            background: '#1e293b', borderRadius: '12px', padding: '20px',
            border: `1px solid ${stat.color}33`, borderLeft: `4px solid ${stat.color}`
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
          {trucksLoaded && <MapView trucks={filteredTrucks} />}
        </div>

        {/* Truck Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
          {filteredTrucks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#1e293b', borderRadius: '12px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🚛</div>
              <p>No trucks match this filter</p>
              <button
                onClick={resetDemoData}
                style={{
                  background: '#3b82f6', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '10px 20px', cursor: 'pointer',
                  fontWeight: 'bold', marginTop: '12px', fontSize: '13px'
                }}
              >
                🔄 Reload Demo Data
              </button>
            </div>
          )}
          {filteredTrucks.map(truck => (
            <div
              key={truck.id}
              onClick={() => setSelectedTruck(truck)}
              style={{
                background: selectedTruck?.id === truck.id ? '#1e3a5f' : '#1e293b',
                borderRadius: '12px', padding: '16px', cursor: 'pointer',
                border: `1px solid ${selectedTruck?.id === truck.id ? '#3b82f6' : '#334155'}`,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>🚛 {truck.id}</span>
                <span style={{
                  background: (STATUS_COLOR[truck.status] || '#6b7280') + '22',
                  color: STATUS_COLOR[truck.status] || '#6b7280',
                  padding: '3px 10px', borderRadius: '999px',
                  fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {STATUS_EMOJI[truck.status]} {truck.status?.replace('_', ' ')}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>👤 {truck.driver}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>📞 {truck.phone}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                <span>🚀 {truck.speed} km/h</span>
                <span>📍 {truck.completed_stops}/{truck.total_stops} stops</span>
              </div>

              {/* Stops Progress Bar */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                  <span>📍 Stops</span>
                  <span style={{ color: '#22c55e' }}>{truck.completed_stops || 0}/{truck.total_stops || 0}</span>
                </div>
                <div style={{ background: '#334155', borderRadius: '999px', height: '6px' }}>
                  <div style={{
                    background: '#22c55e',
                    width: truck.total_stops ? `${((truck.completed_stops || 0) / truck.total_stops) * 100}%` : '0%',
                    height: '100%', borderRadius: '999px', transition: 'width 0.5s'
                  }} />
                </div>
              </div>

              {/* Dispatch Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDispatchTruckId(truck.id)
                  setDispatchModal(true)
                }}
                style={{
                  background: '#3b82f622', color: '#3b82f6',
                  border: '1px solid #3b82f644', borderRadius: '8px',
                  padding: '6px 12px', cursor: 'pointer',
                  fontSize: '12px', width: '100%',
                  transition: 'all 0.2s'
                }}
              >
                🚛 Dispatch to Bin
              </button>

              {truck.last_updated && (
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
                  Updated: {new Date(truck.last_updated).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Driver Performance Section */}
      {performance && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px' }}>👤 Driver Performance Today</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Driver', 'Van', 'Bins Today', 'Avg Response', 'Distance', 'Rating', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', color: '#64748b',
                    fontSize: '12px', textTransform: 'uppercase'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.drivers?.map((driver, i) => (
                <tr key={i} style={{ borderTop: '1px solid #334155' }}>
                  <td style={{ padding: '14px 16px' }}>👤 {driver.driver_name}</td>
                  <td style={{ padding: '14px 16px', color: '#3b82f6' }}>{driver.van_id}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: '#22c55e22', color: '#22c55e',
                      padding: '2px 10px', borderRadius: '999px', fontWeight: 'bold'
                    }}>
                      {driver.bins_today} bins
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>⏱️ {driver.avg_response}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>📏 {driver.distance_today}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {'⭐'.repeat(Math.round(driver.rating))}
                    <span style={{ color: '#f59e0b', marginLeft: '4px' }}>{driver.rating}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: driver.status === 'idle' ? '#6b728022' : '#22c55e22',
                      color: driver.status === 'idle' ? '#6b7280' : '#22c55e',
                      padding: '3px 10px', borderRadius: '999px',
                      fontSize: '12px', textTransform: 'capitalize'
                    }}>
                      {driver.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px', marginTop: '16px', paddingTop: '16px',
            borderTop: '1px solid #334155'
          }}>
            {[
              { label: 'Total Bins Today', value: performance.total_bins_today, emoji: '🗑️' },
              { label: 'Total Distance',   value: performance.total_distance_today, emoji: '📏' },
              { label: 'Active Trucks',    value: `${performance.active_trucks}/${performance.active_trucks + performance.idle_trucks}`, emoji: '🚛' },
            ].map(item => (
              <div key={item.label} style={{
                textAlign: 'center', background: '#0f172a',
                borderRadius: '8px', padding: '12px'
              }}>
                <div style={{ fontSize: '24px' }}>{item.emoji}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{item.value}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px',
            padding: '32px', minWidth: '320px',
            border: '1px solid #334155'
          }}>
            <h3 style={{ margin: '0 0 20px', color: 'white' }}>🚛 Dispatch Truck</h3>
            <label style={{
              display: 'block', color: '#64748b', fontSize: '12px',
              textTransform: 'uppercase', marginBottom: '6px'
            }}>
              Select Bin
            </label>
            <select
              value={dispatchBinId}
              onChange={e => setDispatchBinId(e.target.value)}
              style={{
                width: '100%', background: '#0f172a', color: 'white',
                border: '1px solid #334155', borderRadius: '8px',
                padding: '12px', marginBottom: '20px'
              }}
            >
              <option value="">Select bin...</option>
              {dustbins.map(b => (
                <option key={b.id} value={b.id}>
                  Bin #{b.id} - {b.location} ({b.fill_level?.toFixed(0)}%)
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setDispatchModal(false); setDispatchBinId('') }}
                style={{
                  flex: 1, background: '#334155', color: 'white',
                  border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispatch}
                disabled={!dispatchBinId}
                style={{
                  flex: 1, background: '#3b82f6', color: 'white',
                  border: 'none', borderRadius: '8px', padding: '12px',
                  cursor: 'pointer', fontWeight: 'bold',
                  opacity: dispatchBinId ? 1 : 0.5
                }}
              >
                🚛 Dispatch!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
