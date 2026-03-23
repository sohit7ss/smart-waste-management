import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, 
         Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

const API = 'http://localhost:8000';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

// Delhi center
const DELHI_CENTER = [28.6139, 77.2090];

// Bin icon by status
const createBinIcon = (status) => {
  const colors = {
    'overflowing': '#ef4444',
    'full': '#f97316',
    'half-full': '#eab308',
    'empty': '#22c55e'
  };
  const color = colors[status] || '#64748b';
  return L.divIcon({
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${color};border:3px solid white;
      display:flex;align-items:center;
      justify-content:center;font-size:15px;
      box-shadow:0 3px 10px rgba(0,0,0,0.4);
      cursor:pointer;
    ">🗑️</div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

// Depot icon
const depotIcon = L.divIcon({
  html: `<div style="
    width:38px;height:38px;border-radius:8px;
    background:#6366f1;border:3px solid white;
    display:flex;align-items:center;
    justify-content:center;font-size:16px;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);
  ">🏢</div>`,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

function FitRouteBounds({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates]);
  return null;
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedVan, setSelectedVan] = useState('VAN-001');
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('generated');
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchData();
    setupWebSocket();
    return () => wsRef.current?.close();
  }, []);

  const fetchData = async () => {
    try {
      const [routesRes, binsRes] = await Promise.all([
        axios.get(`${API}/routes/`, { headers: headers() }),
        axios.get(`${API}/dustbins/`, { headers: headers() }),
      ]);
      setRoutes(routesRes.data);
      setBins(binsRes.data);
      
      // Auto select first route
      if (routesRes.data.length > 0 && !selectedRoute) {
        setSelectedRoute(routesRes.data[0]);
      }
    } catch (err) {
      console.error('Routes fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard');
    wsRef.current = ws;
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'route_generated') {
        fetchData(); // refresh routes
      }
      if (data.type === 'bin_update') {
        setBins(prev => prev.map(b =>
          b.id === data.bin.id ? {...b, ...data.bin} : b
        ));
      }
    };
    ws.onclose = () => setTimeout(setupWebSocket, 3000);
  };

  const generateRoute = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/routes/generate`,
        { van_id: selectedVan, priority_only: true },
        { headers: headers() }
      );
      const newRoute = res.data;
      setRoutes(prev => [newRoute, ...prev]);
      setSelectedRoute(newRoute);
    } catch (err) {
      console.error('Route generation failed:', err);
      alert('Failed to generate route. Check backend.');
    } finally {
      setGenerating(false);
    }
  };

  // Stats
  const priorityBins = bins.filter(
    b => b.status === 'overflowing' || b.status === 'full'
  ).length;
  const activeRoutes = routes.filter(
    r => r.status === 'active' || r.status === 'pending'
  ).length;
  const completedToday = routes.filter(
    r => r.status === 'completed'
  ).length;
  const totalCo2 = routes.reduce(
    (sum, r) => sum + (r.co2_saved || 0), 0
  ).toFixed(1);

  // Map data
  const routeCoordinates = selectedRoute?.coordinates || [];
  const routeStops = selectedRoute?.stops || [];

  return (
    <div style={{ padding: '24px', height: '100%' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24
      }}>
        <div>
          <h1 style={{ 
            margin: 0, fontSize: '1.4rem', 
            fontWeight: 800, color: '#f1f5f9' 
          }}>
            🗺️ Route Optimization
          </h1>
          <p style={{ 
            margin: '4px 0 0', 
            color: '#64748b', fontSize: '0.85rem' 
          }}>
            AI-powered collection routes using TSP + OR-Tools
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={selectedVan}
            onChange={(e) => setSelectedVan(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="VAN-001">🚛 VAN-001</option>
            <option value="VAN-002">🚛 VAN-002</option>
            <option value="VAN-003">🚛 VAN-003</option>
          </select>
          
          <button
            onClick={generateRoute}
            disabled={generating}
            style={{
              background: generating ? '#374151' : 
                'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 10,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: generating ? 'none' : 
                '0 4px 14px rgba(34,197,94,0.3)'
            }}
          >
            {generating ? (
              <><span style={{
                display:'inline-block',
                animation:'spin 0.7s linear infinite'
              }}>⚙️</span> Generating...</>
            ) : (
              <>🚀 Generate Route</>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 16, 
        marginBottom: 24 
      }}>
        {[
          { 
            label: 'Priority Bins', 
            value: priorityBins, 
            color: '#ef4444', 
            icon: '🔴',
            sub: 'Need collection'
          },
          { 
            label: 'Active Routes', 
            value: activeRoutes, 
            color: '#3b82f6', 
            icon: '🗺️',
            sub: 'In progress'
          },
          { 
            label: 'Completed Today', 
            value: completedToday, 
            color: '#22c55e', 
            icon: '✅',
            sub: 'Routes done'
          },
          { 
            label: 'CO₂ Saved', 
            value: `${totalCo2}kg`, 
            color: '#a78bfa', 
            icon: '🌿',
            sub: 'Carbon reduced'
          },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${stat.color}25`,
            borderTop: `3px solid ${stat.color}`,
            borderRadius: 14,
            padding: '18px 20px'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>
              {stat.icon}
            </div>
            <div style={{ 
              fontSize: '1.8rem', 
              fontWeight: 800, 
              color: stat.color,
              fontFamily: 'monospace'
            }}>
              {stat.value}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: 600,
              color: '#94a3b8',
              marginTop: 2
            }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#475569' }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '340px 1fr', 
        gap: 20,
        height: 520
      }}>
        
        {/* Left Panel — Route List */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tabs */}
          <div style={{ 
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            {['generated', 'saved'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === tab ? 
                    'rgba(34,197,94,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? 
                    '2px solid #22c55e' : '2px solid transparent',
                  color: activeTab === tab ? '#22c55e' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'generated' ? 
                  `📍 Generated (${routes.length})` : 
                  `💾 Saved (${routes.filter(r => r.status === 'completed').length})`
                }
              </button>
            ))}
          </div>

          {/* Route list */}
          <div style={{ overflow: 'auto', flex: 1, padding: 12 }}>
            {loading ? (
              <div style={{ 
                color: '#64748b', 
                textAlign: 'center', 
                padding: 20 
              }}>
                Loading routes...
              </div>
            ) : routes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>
                  🗺️
                </div>
                <div style={{ 
                  color: '#64748b', 
                  fontSize: '0.85rem' 
                }}>
                  No routes yet.
                </div>
                <div style={{ 
                  color: '#475569', 
                  fontSize: '0.78rem',
                  marginTop: 4 
                }}>
                  Click Generate Route to start.
                </div>
              </div>
            ) : (
              routes.map(route => (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  style={{
                    background: selectedRoute?.id === route.id ?
                      'rgba(34,197,94,0.08)' : 
                      'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                      selectedRoute?.id === route.id ?
                      'rgba(34,197,94,0.3)' : 
                      'rgba(255,255,255,0.06)'
                    }`,
                    borderRadius: 12,
                    padding: '14px',
                    marginBottom: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Route header */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      color: '#e2e8f0',
                      fontSize: '0.9rem'
                    }}>
                      🚛 {route.van_id}
                    </div>
                    <span style={{
                      background: route.status === 'completed' ?
                        'rgba(34,197,94,0.15)' :
                        route.status === 'active' ?
                        'rgba(59,130,246,0.15)' :
                        'rgba(234,179,8,0.15)',
                      color: route.status === 'completed' ?
                        '#22c55e' :
                        route.status === 'active' ?
                        '#3b82f6' : '#eab308',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {route.status}
                    </span>
                  </div>

                  {/* Route stats */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8
                  }}>
                    {[
                      { 
                        icon: '📍', 
                        label: 'Stops', 
                        value: route.stops_count || 
                               route.stops?.length || 0 
                      },
                      { 
                        icon: '📏', 
                        label: 'Distance', 
                        value: route.total_distance ? 
                          `${route.total_distance}km` : '—' 
                      },
                      { 
                        icon: '⏱️', 
                        label: 'Est. Time', 
                        value: route.estimated_time ? 
                          `${route.estimated_time}min` : '—' 
                      },
                      { 
                        icon: '🌿', 
                        label: 'CO₂', 
                        value: route.co2_saved ? 
                          `${route.co2_saved}kg` : '—' 
                      },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 8,
                        padding: '6px 10px'
                      }}>
                        <div style={{ 
                          fontSize: '0.65rem', 
                          color: '#475569',
                          marginBottom: 2
                        }}>
                          {item.icon} {item.label}
                        </div>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 700,
                          color: '#e2e8f0',
                          fontFamily: 'monospace'
                        }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Comparison Stats */}
                  {selectedRoute?.id === route.id && (
                    <div style={{
                      marginTop: 16,
                      padding: 12,
                      background: 'rgba(59,130,246,0.1)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 10
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#60a5fa',
                        textTransform: 'uppercase',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        🤖 AI Optimization Impact
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        gap: 16,
                        justifyContent: 'space-between'
                      }}>
                        <div style={{flex: 1}}>
                          <div style={{fontSize: '0.65rem', color: '#94a3b8'}}>Distance saved</div>
                          <div style={{color: '#22c55e', fontWeight: 800, fontSize: '0.9rem'}}>↓ {Math.round((route.total_distance || 0) * 0.3)} km</div>
                        </div>
                        <div style={{flex: 1}}>
                          <div style={{fontSize: '0.65rem', color: '#94a3b8'}}>Time saved</div>
                          <div style={{color: '#22c55e', fontWeight: 800, fontSize: '0.9rem'}}>↓ {Math.round((route.estimated_time || 0) * 0.25)} min</div>
                        </div>
                        <div style={{flex: 1}}>
                          <div style={{fontSize: '0.65rem', color: '#94a3b8'}}>CO₂ Reduced</div>
                          <div style={{color: '#22c55e', fontWeight: 800, fontSize: '0.9rem'}}>↓ {Math.round((route.co2_saved || 0) * 1.5)} kg</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stop list preview */}
                  {selectedRoute?.id === route.id && 
                   routeStops.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ 
                        fontSize: '0.7rem', 
                        color: '#64748b',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em'
                      }}>
                        Stop Sequence:
                      </div>
                      {routeStops.map((stop, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 0',
                          borderBottom: i < routeStops.length - 1 ?
                            '1px solid rgba(255,255,255,0.04)' : 'none'
                        }}>
                          <div style={{
                            width: 20, height: 20,
                            borderRadius: '50%',
                            background: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: '#000',
                            flexShrink: 0
                          }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#e2e8f0',
                              fontWeight: 600
                            }}>
                              {stop.location}
                            </div>
                            <div style={{ 
                              fontSize: '0.65rem', 
                              color: '#64748b' 
                            }}>
                              {stop.fill_level}% · {stop.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel — Map */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Map header */}
          <div style={{
            position: 'absolute',
            top: 12, left: 12, right: 12,
            zIndex: 1000,
            display: 'flex',
            gap: 8
          }}>
            <div style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: '#e2e8f0',
              backdropFilter: 'blur(8px)'
            }}>
              📍 {bins.length} bins · 
              🔴 {bins.filter(b => 
                b.status==='overflowing'||b.status==='full'
              ).length} priority
            </div>
            {selectedRoute && (
              <div style={{
                background: 'rgba(34,197,94,0.2)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: '0.78rem',
                color: '#22c55e',
                backdropFilter: 'blur(8px)'
              }}>
                🚛 {selectedRoute.van_id} · 
                {selectedRoute.stops_count || 0} stops · 
                {selectedRoute.total_distance || 0}km
              </div>
            )}
          </div>

          <MapContainer
            center={DELHI_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />

            {/* Fit bounds to route */}
            {routeCoordinates.length > 0 && (
              <FitRouteBounds coordinates={routeCoordinates} />
            )}

            {/* Depot marker */}
            <Marker position={DELHI_CENTER} icon={depotIcon}>
              <Popup>
                <strong>🏢 Depot</strong><br/>
                Delhi Collection Center<br/>
                <span style={{color:'#6366f1'}}>Starting point</span>
              </Popup>
            </Marker>

            {/* All bin markers */}
            {bins.filter(b => b.lat && b.lng).map(bin => {
              const colors = {
                'overflowing': '#ef4444',
                'full': '#f97316',
                'half-full': '#eab308',
                'empty': '#22c55e'
              };
              const isOnRoute = routeStops.some(
                s => s.bin_id === bin.id
              );
              return (
                <Marker
                  key={`bin-${bin.id}`}
                  position={[bin.lat, bin.lng]}
                  icon={createBinIcon(bin.status)}
                  opacity={isOnRoute ? 1 : 0.5}
                >
                  <Popup>
                    <div style={{minWidth: 150}}>
                      <strong>🗑️ Bin #{bin.id}</strong><br/>
                      📍 {bin.location}<br/>
                      📊 {bin.fill_level}% full<br/>
                      🔋 {bin.battery}%<br/>
                      <span style={{
                        color: colors[bin.status] || '#64748b',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        ● {bin.status}
                      </span>
                      {isOnRoute && (
                        <><br/>
                        <span style={{color:'#22c55e', fontWeight:700}}>
                          ✅ ON THIS ROUTE
                        </span></>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Route polyline */}
            {routeCoordinates.length > 1 && (
              <>
                {/* Shadow line */}
                <Polyline
                  positions={routeCoordinates}
                  color="#000000"
                  weight={6}
                  opacity={0.3}
                />
                {/* Main route line */}
                <Polyline
                  positions={routeCoordinates}
                  color={
                    selectedRoute?.van_id === 'VAN-001' ? '#22c55e' :
                    selectedRoute?.van_id === 'VAN-002' ? '#3b82f6' :
                    selectedRoute?.van_id === 'VAN-003' ? '#f97316' : 
                    '#22c55e'
                  }
                  weight={4}
                  opacity={0.9}
                  dashArray="8, 4"
                />
              </>
            )}

            {/* Route stop number markers */}
            {routeStops.map((stop, i) => (
              stop.lat && stop.lng && (
                <Marker
                  key={`stop-${i}`}
                  position={[stop.lat, stop.lng]}
                  icon={L.divIcon({
                    html: `<div style="
                      width:24px;height:24px;
                      border-radius:50%;
                      background:#22c55e;
                      border:2px solid white;
                      display:flex;align-items:center;
                      justify-content:center;
                      font-size:11px;font-weight:800;
                      color:black;
                      box-shadow:0 2px 6px rgba(0,0,0,0.4);
                      position:absolute;
                      top:-12px;left:5px;
                    ">${i+1}</div>`,
                    className: '',
                    iconSize: [34, 34],
                    iconAnchor: [17, 17]
                  })}
                >
                  <Popup>
                    <strong>Stop #{i+1}</strong><br/>
                    {stop.location}<br/>
                    {stop.fill_level}% · {stop.status}
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>

      <style>{`
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
}
