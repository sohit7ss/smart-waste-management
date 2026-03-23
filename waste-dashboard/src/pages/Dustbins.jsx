import { useState, useEffect } from 'react'
import axios from 'axios'

const BASE = `http://${window.location.hostname}:8000`

export default function Dustbins() {
  const [dustbins, setDustbins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    fetchDustbins()
    const interval = setInterval(fetchDustbins, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchDustbins = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${BASE}/dustbins/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      // Handle both array and object responses
      const data = res.data
      if (Array.isArray(data)) {
        setDustbins(data)
      } else if (data.dustbins) {
        setDustbins(data.dustbins)
      } else if (data.items) {
        setDustbins(data.items)
      } else {
        setDustbins([])
      }
      setError(null)
    } catch (err) {
      console.error('Dustbins fetch error:', err)
      setError(`Failed: ${err.response?.status} - ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getFillColor = (level) => {
    if (level >= 90) return '#ef4444'
    if (level >= 60) return '#f97316'
    if (level >= 30) return '#f59e0b'
    return '#22c55e'
  }

  const getStatusBadge = (status) => {
    const config = {
      'empty':       { bg: '#22c55e22', color: '#22c55e', label: '🟢 Empty' },
      'half-full':   { bg: '#f59e0b22', color: '#f59e0b', label: '🟡 Half Full' },
      'full':        { bg: '#f9731622', color: '#f97316', label: '🟠 Full' },
      'overflowing': { bg: '#ef444422', color: '#ef4444', label: '🔴 Overflowing' },
    }
    return config[status] || { bg: '#94a3b822', color: '#94a3b8', label: status }
  }

  const getWasteTypeBadge = (type) => {
    if (!type) return { bg: '#33415522', color: '#94a3b8', label: 'Mixed' };
    const t = type.toLowerCase();
    if (t.includes('organic')) return { bg: '#22c55e22', color: '#22c55e', label: '🌱 Organic' };
    if (t.includes('recycl')) return { bg: '#3b82f622', color: '#3b82f6', label: '♻️ Recyclable' };
    if (t.includes('hazard')) return { bg: '#ef444422', color: '#ef4444', label: '☢️ Hazardous' };
    if (t.includes('dry')) return { bg: '#f59e0b22', color: '#f59e0b', label: '📦 Dry Waste' };
    return { bg: '#33415522', color: '#94a3b8', label: type };
  }

  const filtered = dustbins.filter(bin => {
    const matchSearch = bin.location?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || bin.status === filterStatus
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      alignItems: 'center', height: '400px',
      color: '#22c55e', fontSize: '18px'
    }}>
      <div>Loading dustbins...</div>
    </div>
  )

  return (
    <div style={{ padding: '24px', color: 'white' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>
            🗑️ Smart Bin Fleet
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            {dustbins.length} bins monitored in real-time
          </p>
        </div>
        <button
          onClick={fetchDustbins}
          style={{
            background: '#22c55e22',
            color: '#22c55e',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#ef444422',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          color: '#ef4444'
        }}>
          ❌ {error}
          <br/>
          <small>Make sure backend is running: python main.py</small>
        </div>
      )}

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Total Bins', value: dustbins.length, color: '#3b82f6' },
          { label: 'Overflowing', value: dustbins.filter(b => b.status === 'overflowing').length, color: '#ef4444' },
          { label: 'Full', value: dustbins.filter(b => b.status === 'full').length, color: '#f97316' },
          { label: 'Empty', value: dustbins.filter(b => b.status === 'empty').length, color: '#22c55e' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '16px',
            border: `1px solid ${stat.color}33`
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: stat.color
            }}>{stat.value}</div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: '12px',
        marginBottom: '16px', flexWrap: 'wrap'
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search location..."
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 16px',
            color: 'white',
            flex: 1,
            minWidth: '200px'
          }}
        />
        {['all', 'empty', 'half-full', 'full', 'overflowing'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              background: filterStatus === s ? '#22c55e' : '#1e293b',
              color: 'white',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontSize: '13px'
            }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px',
          color: '#64748b', background: '#1e293b',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
          <p>No dustbins found.</p>
          <p style={{ fontSize: '13px' }}>
            Make sure simulate_iot.py is running!
          </p>
        </div>
      ) : (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            color: 'white'
          }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['ID', 'Location', 'Fill Level', 'Status',
                  'Battery', 'Waste Type', 'Last Updated', 'Actions'
                ].map(h => (
                  <th key={h} style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    color: '#64748b',
                    fontWeight: '600',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((bin, i) => {
                const badge = getStatusBadge(bin.status)
                const typeBadge = getWasteTypeBadge(bin.waste_type)
                return (
                  <tr key={bin.id} style={{
                    borderTop: '1px solid #334155',
                    background: i % 2 === 0 ? '#1e293b' : '#1a2744',
                    transition: 'background 0.2s'
                  }}>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>
                      #{bin.id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      📍 {bin.location}
                    </td>
                    <td style={{ padding: '14px 16px', minWidth: '150px' }}>
                      <div style={{
                        background: '#334155',
                        borderRadius: '999px',
                        height: '8px',
                        marginBottom: '4px'
                      }}>
                        <div style={{
                          background: getFillColor(bin.fill_level),
                          width: `${Math.min(bin.fill_level, 100)}%`,
                          height: '100%',
                          borderRadius: '999px',
                          transition: 'width 0.5s'
                        }}/>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: getFillColor(bin.fill_level),
                        fontWeight: 'bold'
                      }}>
                        {bin.fill_level?.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: badge.bg,
                        color: badge.color,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        color: (bin.battery || 100) < 20
                          ? '#ef4444' : '#22c55e'
                      }}>
                        🔋 {(bin.battery || 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: typeBadge.bg,
                        color: typeBadge.color,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textTransform: 'capitalize',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        {typeBadge.label}
                      </span>
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      color: '#64748b',
                      fontSize: '12px'
                    }}>
                      {bin.last_updated
                        ? new Date(bin.last_updated).toLocaleTimeString()
                        : 'Just now'
                      }
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => window.open(
                          `${BASE}/dustbins/${bin.id}/qr`
                        )}
                        style={{
                          background: '#3b82f622',
                          color: '#3b82f6',
                          border: '1px solid #3b82f644',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                         QR Code
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
