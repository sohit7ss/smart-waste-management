import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const BASE = 'http://localhost:8000'

const DEFAULT_TRENDS = [
  { day: 'Mon', dry: 45, wet: 30, total: 75 },
  { day: 'Tue', dry: 52, wet: 38, total: 90 },
  { day: 'Wed', dry: 48, wet: 42, total: 90 },
  { day: 'Thu', dry: 61, wet: 35, total: 96 },
  { day: 'Fri', dry: 55, wet: 48, total: 103 },
  { day: 'Sat', dry: 67, wet: 52, total: 119 },
  { day: 'Sun', dry: 43, wet: 29, total: 72 },
]

const DEFAULT_PEAKS = [
  { hour: '6AM',  waste: 15 },
  { hour: '8AM',  waste: 45 },
  { hour: '10AM', waste: 30 },
  { hour: '12PM', waste: 65 },
  { hour: '2PM',  waste: 55 },
  { hour: '4PM',  waste: 70 },
  { hour: '6PM',  waste: 85 },
  { hour: '8PM',  waste: 60 },
  { hour: '10PM', waste: 25 },
]

const DEFAULT_AREAS = [
  { name: 'Sector 1', complaints: 12, avg_fill: 78, score: 22 },
  { name: 'Sector 2', complaints: 8,  avg_fill: 65, score: 35 },
  { name: 'Sector 3', complaints: 3,  avg_fill: 35, score: 65 },
  { name: 'Sector 4', complaints: 15, avg_fill: 88, score: 12 },
  { name: 'Sector 5', complaints: 6,  avg_fill: 55, score: 45 },
]

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6']

export default function Analytics() {
  const [trends, setTrends]   = useState(DEFAULT_TRENDS)
  const [peaks, setPeaks]     = useState(DEFAULT_PEAKS)
  const [areas, setAreas]     = useState(DEFAULT_AREAS)
  const [carbon, setCarbon]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    const token = localStorage.getItem('token')
    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : {}

    try {
      const res = await axios.get(
        `${BASE}/analytics/waste-trends`, { headers }
      )
      if (res.data?.trends?.length > 0) {
        setTrends(res.data.trends)
      }
    } catch { /* use defaults */ }

    try {
      const res = await axios.get(
        `${BASE}/analytics/peak-hours`, { headers }
      )
      if (res.data?.peak_hours?.length > 0) {
        setPeaks(res.data.peak_hours)
      }
    } catch { /* use defaults */ }

    try {
      const res = await axios.get(
        `${BASE}/analytics/area-comparison`, { headers }
      )
      if (res.data?.areas?.length > 0) {
        setAreas(res.data.areas)
      }
    } catch { /* use defaults */ }

    try {
      const res = await axios.get(
        `${BASE}/analytics/carbon`, { headers }
      )
      setCarbon(res.data)
    } catch { /* ignore */ }

    setLoading(false)
  }

  const wasteTypes = [
    { name: 'Dry Waste',       value: 40, color: '#f59e0b' },
    { name: 'Wet Waste',       value: 35, color: '#22c55e' },
    { name: 'Recyclable',      value: 15, color: '#3b82f6' },
    { name: 'Hazardous',       value: 10, color: '#ef4444' },
  ]

  return (
    <div style={{ padding: '24px', color: 'white' }}>
      <h2 style={{ marginBottom: '8px' }}>
        📊 City Intelligence Analytics
      </h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Real-time waste management insights
      </p>

      {/* Carbon Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          {
            label: 'CO₂ Saved Monthly',
            value: carbon?.co2_saved_monthly_kg
              ? `${carbon.co2_saved_monthly_kg}kg`
              : '180kg',
            color: '#22c55e',
            emoji: '🌱'
          },
          {
            label: 'Fuel Saved Daily',
            value: carbon?.fuel_saved_liters_daily
              ? `${carbon.fuel_saved_liters_daily}L`
              : '15L',
            color: '#3b82f6',
            emoji: '⛽'
          },
          {
            label: 'Cost Saved Monthly',
            value: carbon?.cost_saved_monthly_inr
              ? `₹${carbon.cost_saved_monthly_inr}`
              : '₹8,400',
            color: '#f59e0b',
            emoji: '💰'
          },
          {
            label: 'Efficiency',
            value: carbon?.efficiency_improvement_percent
              ? `${carbon.efficiency_improvement_percent}%`
              : '35%',
            color: '#8b5cf6',
            emoji: '📈'
          },
        ].map(card => (
          <div key={card.label} style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${card.color}33`
          }}>
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>
              {card.emoji}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: card.color
            }}>
              {card.value}
            </div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Waste Trends */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>
            📈 Waste Generation (7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="dryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="wetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
              <XAxis dataKey="day" stroke="#64748b"/>
              <YAxis stroke="#64748b"/>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend/>
              <Area
                type="monotone"
                dataKey="dry"
                name="Dry Waste (kg)"
                stroke="#f59e0b"
                fill="url(#dryGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="wet"
                name="Wet Waste (kg)"
                stroke="#22c55e"
                fill="url(#wetGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>
            ⏰ Peak Waste Hours
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peaks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
              <XAxis dataKey="hour" stroke="#64748b"/>
              <YAxis stroke="#64748b"/>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar
                dataKey="waste"
                name="Fill Rate %"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Area Comparison */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>
            🗺️ Area Comparison
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={areas} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
              <XAxis type="number" stroke="#64748b"/>
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar
                dataKey="avg_fill"
                name="Avg Fill %"
                fill="#f97316"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Waste Type Pie */}
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>
            ♻️ Waste Composition
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={wasteTypes}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={false}
              >
                {wasteTypes.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Area Stats Table */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px', color: '#e2e8f0' }}>
          🏆 Area Performance Ranking
        </h3>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          color: 'white'
        }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Rank', 'Area', 'Avg Fill', 'Complaints',
                'Cleanliness Score'
              ].map(h => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  color: '#64748b',
                  fontSize: '12px',
                  textTransform: 'uppercase'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...areas]
              .sort((a, b) =>
                (b.cleanliness_score || b.score || 0) -
                (a.cleanliness_score || a.score || 0)
              )
              .map((area, i) => (
                <tr key={area.name} style={{
                  borderTop: '1px solid #334155'
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                    {area.name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      color: area.avg_fill >= 80
                        ? '#ef4444'
                        : area.avg_fill >= 50
                        ? '#f59e0b'
                        : '#22c55e'
                    }}>
                      {area.avg_fill}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {area.complaints}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        background: '#334155',
                        borderRadius: '999px',
                        height: '6px',
                        flex: 1
                      }}>
                        <div style={{
                          background: '#22c55e',
                          width: `${area.cleanliness_score || area.score || 0}%`,
                          height: '100%',
                          borderRadius: '999px'
                        }}/>
                      </div>
                      <span style={{ color: '#22c55e', fontSize: '13px' }}>
                        {area.cleanliness_score || area.score || 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
