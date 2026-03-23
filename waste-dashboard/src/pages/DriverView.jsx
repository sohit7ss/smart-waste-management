import { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, 
  Polyline, Circle, useMap 
} from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

const API = 'http://localhost:8000';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const DELHI_CENTER = [28.6139, 77.2090];

// Driver location icon (pulsing blue dot)
const driverIcon = L.divIcon({
  html: `<div style="position:relative">
    <div style="
      width:16px;height:16px;border-radius:50%;
      background:#3b82f6;border:3px solid white;
      box-shadow:0 0 0 4px rgba(59,130,246,0.3);
      animation:driverPulse 1.5s ease infinite;
      position:relative;z-index:2;
    "></div>
    <div style="
      position:absolute;top:-4px;left:-4px;
      width:24px;height:24px;border-radius:50%;
      background:rgba(59,130,246,0.2);
      animation:driverRipple 1.5s ease infinite;
    "></div>
  </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Bin icons by status
const createBinIcon = (status, number) => {
  const colors = {
    'overflowing': '#ef4444',
    'full': '#f97316',
    'half-full': '#eab308',
    'empty': '#22c55e',
    'collected': '#22c55e'
  };
  const color = colors[status] || '#64748b';
  return L.divIcon({
    html: `<div style="
      position:relative;
      width:38px;height:38px;
    ">
      <div style="
        width:38px;height:38px;border-radius:50%;
        background:${color};border:3px solid white;
        display:flex;align-items:center;
        justify-content:center;
        box-shadow:0 3px 10px rgba(0,0,0,0.4);
        font-size:13px;font-weight:800;color:white;
      ">${number}</div>
    </div>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });
};

// Complaint icon
const complaintIcon = L.divIcon({
  html: `<div style="
    width:32px;height:32px;border-radius:50%;
    background:#f97316;border:3px solid white;
    display:flex;align-items:center;
    justify-content:center;font-size:14px;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);
    animation:complaintPulse 2s ease infinite;
  ">⚠️</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position]);
  return null;
}

export default function DriverView() {
  const [selectedVan, setSelectedVan] = useState('VAN-001');
  const [driverStatus, setDriverStatus] = useState('available');
  const [driverLocation, setDriverLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [completedStops, setCompletedStops] = useState([]);
  const [collecting, setCollecting] = useState(null);
  const [stats, setStats] = useState({
    collected: 0,
    distance: 0,
    co2: 0,
    timeActive: 0
  });
  const [notification, setNotification] = useState(null);
  const wsRef = useRef(null);
  const locationWatchRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    fetchRouteAndComplaints();
    startGPSTracking();
    setupWebSocket();
    startStatsTimer();
    
    return () => {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedVan]);

  const fetchRouteAndComplaints = async () => {
    try {
      const [routesRes, complaintsRes] = await Promise.all([
        axios.get(`${API}/routes`, { headers: headers() }),
        axios.get(`${API}/complaints`, { headers: headers() })
      ]);
      
      // Get latest pending route for this van
      const vanRoutes = routesRes.data.filter(
        r => r.van_id === selectedVan && 
             r.status !== 'completed'
      );
      
      if (vanRoutes.length > 0) {
        const latestRoute = vanRoutes[0];
        setRoute(latestRoute);
        setStops(latestRoute.stops || []);
      }
      
      // Get pending/assigned complaints
      const pending = complaintsRes.data.filter(
        c => c.status === 'pending' || c.status === 'assigned'
      ).sort((a, b) => {
        // High priority first
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return 0;
      });
      
      setComplaints(complaintsRes.data);
      setNearbyComplaints(pending.slice(0, 5));
      
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const startGPSTracking = () => {
    if (!navigator.geolocation) {
      // Fallback to Delhi center
      setDriverLocation(DELHI_CENTER);
      return;
    }
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      pos => setDriverLocation([
        pos.coords.latitude, 
        pos.coords.longitude
      ]),
      () => setDriverLocation(DELHI_CENTER)
    );
    
    // Watch position continuously
    locationWatchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const newPos = [
          pos.coords.latitude,
          pos.coords.longitude
        ];
        setDriverLocation(newPos);
        
        // Update driver location in backend
        updateDriverLocationInBackend(newPos);
      },
      err => console.log('GPS error:', err),
      { 
        enableHighAccuracy: true, 
        maximumAge: 5000,
        timeout: 10000
      }
    );
  };

  const updateDriverLocationInBackend = async (pos) => {
    try {
      await axios.patch(
        `${API}/fleet/trucks/${selectedVan}/location`,
        { lat: pos[0], lng: pos[1] },
        { headers: headers() }
      );
    } catch (e) {
      // Silent fail - not critical
    }
  };

  const setupWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard');
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // New complaint - notify driver if nearby
      if (data.type === 'new_complaint') {
        const complaint = data.complaint;
        setNearbyComplaints(prev => {
          const exists = prev.find(c => c.id === complaint.id);
          if (exists) return prev;
          // Add to top if high priority
          if (complaint.priority === 'high') {
            showNotification(
              `🔴 HIGH PRIORITY complaint at ${complaint.location}`,
              'urgent'
            );
            return [complaint, ...prev];
          }
          return [...prev, complaint];
        });
      }
      
      // Route updated
      if (data.type === 'route_generated') {
        fetchRouteAndComplaints();
        showNotification(
          '🗺️ New route assigned to ' + selectedVan,
          'info'
        );
      }
    };
    
    ws.onclose = () => setTimeout(setupWebSocket, 3000);
  };

  const startStatsTimer = () => {
    setInterval(() => {
      const mins = Math.floor(
        (Date.now() - startTimeRef.current) / 60000
      );
      setStats(prev => ({...prev, timeActive: mins}));
    }, 60000);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCollect = async (stop, index) => {
    if (completedStops.includes(index)) return;
    setCollecting(index);
    
    try {
      // 1. Update bin status to empty
      if (stop.bin_id) {
        await axios.patch(
          `${API}/dustbins/${stop.bin_id}`,
          { status: 'empty', fill_level: 0 },
          { headers: headers() }
        );
      }
      
      // 2. Find and resolve related complaint
      const complaintIdToResolve = stop.complaint_id || complaints.find(
        c => c.lat === stop.lat && 
             c.lng === stop.lng &&
             c.status !== 'resolved'
      )?.id;
      
      if (complaintIdToResolve) {
        await axios.patch(
          `${API}/complaints/${complaintIdToResolve}/resolve`,
          {},
          { headers: headers() }
        );
        
        // Update local complaints state
        setComplaints(prev => prev.map(c =>
          c.id === complaintIdToResolve 
            ? {...c, status: 'resolved'} 
            : c
        ));
        setNearbyComplaints(prev => 
          prev.filter(c => c.id !== complaintIdToResolve)
        );
        
        showNotification(
          `✅ Complaint resolved at ${stop.location}`,
          'success'
        );
      } else {
        showNotification(
          `✅ Bin collected at ${stop.location}`,
          'success'
        );
      }
      
      // 3. Mark stop as completed
      setCompletedStops(prev => [...prev, index]);
      
      // 4. Update stats
      setStats(prev => ({
        ...prev,
        collected: prev.collected + 1,
        distance: prev.distance + (stop.distance_from_prev || 0.5),
        co2: parseFloat(
          (prev.co2 + (stop.distance_from_prev || 0.5) * 0.21)
          .toFixed(2)
        )
      }));
      
      // 5. Check if all stops done
      if (completedStops.length + 1 === stops.length) {
        handleRouteComplete();
      }
      
    } catch (err) {
      console.error('Collection error:', err);
      showNotification('❌ Failed to mark as collected', 'error');
    } finally {
      setCollecting(null);
    }
  };

  const handleAcceptComplaint = async (complaint) => {
    try {
      await axios.patch(
        `${API}/complaints/${complaint.id}/assign`,
        { van_id: selectedVan },
        { headers: headers() }
      );
      
      // Add to stops
      setStops(prev => [...prev, {
        bin_id: null,
        location: complaint.location,
        lat: complaint.lat,
        lng: complaint.lng,
        fill_level: 100,
        status: 'complaint',
        description: complaint.description,
        complaint_id: complaint.id,
        priority: complaint.priority
      }]);
      
      setNearbyComplaints(prev => prev.map(c => 
        c.id === complaint.id ? {...c, status: 'assigned'} : c
      ));
      
      showNotification(
        `🗺️ Navigating to ${complaint.location}`,
        'info'
      );
      
    } catch (err) {
      console.error('Accept complaint error:', err);
    }
  };

  const handleRouteComplete = async () => {
    try {
      if (route?.id) {
        await axios.patch(
          `${API}/routes/${route.id}`,
          { status: 'completed' },
          { headers: headers() }
        );
      }
      showNotification(
        '🎉 Route completed! Great work!',
        'success'
      );
      setDriverStatus('available');
    } catch (err) {
      console.error('Route complete error:', err);
    }
  };

  const getDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lat2) return null;
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLng = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + 
      Math.cos(lat1*Math.PI/180) * 
      Math.cos(lat2*Math.PI/180) * 
      Math.sin(dLng/2)**2;
    return (R * 2 * Math.atan2(
      Math.sqrt(a), Math.sqrt(1-a)
    )).toFixed(1);
  };

  const progress = stops.length > 0 
    ? Math.round((completedStops.length / stops.length) * 100) 
    : 0;
  
  const totalDistance = route?.total_distance || 
    stops.reduce((sum, s) => sum + (s.distance_from_prev || 0), 0);
  
  const estimatedTime = route?.estimated_time || 
    Math.round(totalDistance / 30 * 60);

  // Map coordinates for polyline
  const routeCoords = driverLocation ? [
    driverLocation,
    ...stops
      .filter((_, i) => !completedStops.includes(i))
      .filter(s => s.lat && s.lng)
      .map(s => [s.lat, s.lng])
  ] : [];

  return (
    <div style={{
      height: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      
      {/* Notification toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 80, right: 20,
          zIndex: 9999,
          background: notification.type === 'urgent' ?
            'rgba(239,68,68,0.95)' :
            notification.type === 'success' ?
            'rgba(34,197,94,0.95)' :
            'rgba(59,130,246,0.95)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 12,
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease',
          maxWidth: 320
        }}>
          {notification.message}
        </div>
      )}

      {/* Header bar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.01)'
      }}>
        <span style={{fontSize: '1.5rem'}}>🚛</span>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: 800,
            color: '#f1f5f9'
          }}>
            Driver Dashboard
          </h1>
          <div style={{
            fontSize: '0.72rem',
            color: '#64748b'
          }}>
            Real-time route · GPS tracking · 
            Complaint resolution
          </div>
        </div>
        
        {/* Van selector */}
        <select
          value={selectedVan}
          onChange={e => setSelectedVan(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: '0.85rem',
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
        >
          <option value="VAN-001">🚛 VAN-001 — Ramesh Kumar</option>
          <option value="VAN-002">🚛 VAN-002 — Suresh Singh</option>
          <option value="VAN-003">🚛 VAN-003 — Mahesh Verma</option>
        </select>
        
        {/* Status badge */}
        <select
          value={driverStatus}
          onChange={e => setDriverStatus(e.target.value)}
          style={{
            background: driverStatus === 'available' ?
              'rgba(34,197,94,0.15)' :
              driverStatus === 'on_route' ?
              'rgba(59,130,246,0.15)' :
              'rgba(234,179,8,0.15)',
            border: `1px solid ${
              driverStatus === 'available' ?
              'rgba(34,197,94,0.3)' :
              driverStatus === 'on_route' ?
              'rgba(59,130,246,0.3)' :
              'rgba(234,179,8,0.3)'
            }`,
            color: driverStatus === 'available' ?
              '#22c55e' :
              driverStatus === 'on_route' ?
              '#3b82f6' : '#eab308',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <option value="available">● Available</option>
          <option value="on_route">● On Route</option>
          <option value="break">● On Break</option>
        </select>

        {/* GPS status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
          color: driverLocation ? '#22c55e' : '#64748b'
        }}>
          <div style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: driverLocation ? '#22c55e' : '#64748b',
            animation: driverLocation ? 
              'pulse 1.5s ease infinite' : 'none'
          }}/>
          {driverLocation ? '📍 GPS Active' : '📍 No GPS'}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '400px 1fr',
        flex: 1,
        overflow: 'hidden'
      }}>
        
        {/* LEFT PANEL */}
        <div style={{
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          
          {/* Progress card */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10
            }}>
              <span style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color: '#e2e8f0'
              }}>
                Collection Progress
              </span>
              <span style={{
                fontWeight: 800,
                color: '#22c55e',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                {completedStops.length}/{stops.length} stops
              </span>
            </div>
            
            {/* Progress bar */}
            <div style={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
              marginBottom: 10
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: progress === 100 ?
                  '#22c55e' :
                  'linear-gradient(90deg, #22c55e, #16a34a)',
                borderRadius: 4,
                transition: 'width 0.5s ease'
              }}/>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              <span>
                ⏱️ ~{Math.max(
                  0,
                  estimatedTime - 
                  Math.round(stats.timeActive)
                )} mins left
              </span>
              <span>
                🌿 {(
                  totalDistance * 0.21
                ).toFixed(1)} kg CO₂ saved
              </span>
              <span>📏 {totalDistance?.toFixed(1)} km</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            {[
              { icon:'🗑️', value: stats.collected, label:'Collected' },
              { icon:'📏', value: `${stats.distance.toFixed(1)}km`, label:'Distance' },
              { icon:'🌿', value: `${stats.co2}kg`, label:'CO₂' },
              { icon:'⏱️', value: `${stats.timeActive}m`, label:'Active' },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '12px 8px',
                textAlign: 'center',
                borderRight: '1px solid rgba(255,255,255,0.04)'
              }}>
                <div style={{fontSize: '1.1rem'}}>
                  {stat.icon}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#22c55e',
                  fontFamily: 'monospace'
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '0.62rem',
                  color: '#475569',
                  textTransform: 'uppercase'
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{flex: 1, overflow: 'auto', padding: 16}}>
            
            {/* Priority Complaint Notifications */}
            {nearbyComplaints.length > 0 && (
              <div style={{marginBottom: 20}}>
                <div style={{
                  fontSize: '0.72rem',
                  color: '#f97316',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <div style={{
                    width: 7, height: 7,
                    borderRadius: '50%',
                    background: '#f97316',
                    animation: 'pulse 1.5s ease infinite'
                  }}/>
                  Pending Complaints 
                  ({nearbyComplaints.length})
                </div>
                
                {nearbyComplaints.map(complaint => {
                  const dist = driverLocation ? 
                    getDistance(
                      driverLocation[0], driverLocation[1],
                      complaint.lat, complaint.lng
                    ) : null;
                  
                  return (
                    <div key={complaint.id} style={{
                      background: complaint.priority === 'high' ?
                        'rgba(239,68,68,0.08)' :
                        'rgba(249,115,22,0.06)',
                      border: `1px solid ${
                        complaint.priority === 'high' ?
                        'rgba(239,68,68,0.3)' :
                        'rgba(249,115,22,0.2)'
                      }`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 10
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 6
                      }}>
                        <div style={{flex: 1}}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 3
                          }}>
                            <span style={{
                              background: complaint.priority === 'high' ?
                                'rgba(239,68,68,0.2)' :
                                'rgba(234,179,8,0.2)',
                              color: complaint.priority === 'high' ?
                                '#ef4444' : '#eab308',
                              padding: '1px 7px',
                              borderRadius: 10,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {complaint.priority === 'high' 
                                ? '🔴 HIGH' : '🟡 NORMAL'}
                            </span>
                            {dist && (
                              <span style={{
                                color: '#64748b',
                                fontSize: '0.68rem'
                              }}>
                                📍 {dist} km away
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#e2e8f0',
                            marginBottom: 2
                          }}>
                            {complaint.location}
                          </div>
                          {complaint.description && (
                            <div style={{
                              fontSize: '0.72rem',
                              color: '#64748b'
                            }}>
                              {complaint.description.slice(0, 60)}
                              {complaint.description.length > 60 
                                ? '...' : ''}
                            </div>
                          )}
                        </div>
                        
                        {complaint.image_url && (
                          <img
                            src={complaint.image_url}
                            style={{
                              width: 44, height: 44,
                              borderRadius: 8,
                              objectFit: 'cover',
                              marginLeft: 10,
                              border: '1px solid rgba(255,255,255,0.1)',
                              flexShrink: 0
                            }}
                            alt=""
                          />
                        )}
                      </div>
                      
                      {complaint.status === 'assigned' ? (
                        <div style={{
                          width: '100%',
                          padding: '7px',
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: 8,
                          textAlign: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}>
                          ✅ Accepted & Added to Route
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAcceptComplaint(complaint)}
                          style={{
                            width: '100%',
                            padding: '7px',
                            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 700
                          }}
                        >
                          🗺️ Accept & Navigate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Route Stops */}
            <div style={{
              fontSize: '0.72rem',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
              fontWeight: 700
            }}>
              Route Stops ({stops.length})
            </div>

            {stops.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                color: '#475569'
              }}>
                <div style={{fontSize: '2.5rem', marginBottom: 10}}>
                  🗺️
                </div>
                <div style={{fontSize: '0.85rem', marginBottom: 6}}>
                  No active route
                </div>
                <div style={{fontSize: '0.75rem'}}>
                  Ask admin to generate a route for {selectedVan}
                </div>
              </div>
            ) : (
              stops.map((stop, index) => {
                const isDone = completedStops.includes(index);
                const isCollecting = collecting === index;
                const dist = driverLocation && stop.lat ?
                  getDistance(
                    driverLocation[0], driverLocation[1],
                    stop.lat, stop.lng
                  ) : null;
                
                return (
                  <div key={index} style={{
                    background: isDone ?
                      'rgba(34,197,94,0.06)' :
                      stop.priority === 'high' ?
                      'rgba(239,68,68,0.06)' :
                      'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                      isDone ?
                      'rgba(34,197,94,0.2)' :
                      stop.priority === 'high' ?
                      'rgba(239,68,68,0.2)' :
                      'rgba(255,255,255,0.07)'
                    }`,
                    borderRadius: 12,
                    padding: '14px',
                    marginBottom: 10,
                    opacity: isDone ? 0.6 : 1,
                    transition: 'all 0.3s'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12
                    }}>
                      {/* Stop number */}
                      <div style={{
                        width: 28, height: 28,
                        borderRadius: '50%',
                        background: isDone ?
                          '#22c55e' :
                          stop.priority === 'high' ?
                          '#ef4444' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isDone ? '0.9rem' : '0.8rem',
                        fontWeight: 800,
                        color: 'white',
                        flexShrink: 0
                      }}>
                        {isDone ? '✓' : index + 1}
                      </div>
                      
                      <div style={{flex: 1}}>
                        <div style={{
                          fontWeight: 700,
                          color: isDone ? '#64748b' : '#e2e8f0',
                          fontSize: '0.88rem',
                          marginBottom: 3,
                          textDecoration: isDone ? 
                            'line-through' : 'none'
                        }}>
                          {stop.location}
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 4
                        }}>
                          <span style={{
                            fontSize: '0.72rem',
                            color: stop.fill_level >= 80 ?
                              '#ef4444' :
                              stop.fill_level >= 50 ?
                              '#eab308' : '#22c55e',
                            fontWeight: 600
                          }}>
                            {stop.fill_level}% full
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            color: stop.status === 'overflowing' ?
                              '#ef4444' :
                              stop.status === 'full' ?
                              '#f97316' :
                              stop.status === 'complaint' ?
                              '#f97316' : '#64748b',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}>
                            • {stop.status === 'complaint' ?
                              '⚠️ COMPLAINT' :
                              stop.status?.toUpperCase()}
                          </span>
                        </div>
                        
                        {stop.description && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            marginBottom: 4,
                            fontStyle: 'italic'
                          }}>
                            "{stop.description}"
                          </div>
                        )}
                        
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          {dist && !isDone && (
                            <span style={{
                              fontSize: '0.68rem',
                              color: '#475569'
                            }}>
                              📍 {dist} km away
                            </span>
                          )}
                          
                          {!isDone && (
                            <button
                              onClick={() => handleCollect(stop, index)}
                              disabled={isCollecting}
                              style={{
                                marginLeft: 'auto',
                                padding: '6px 16px',
                                background: isCollecting ?
                                  '#374151' :
                                  'linear-gradient(135deg, #22c55e, #16a34a)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                cursor: isCollecting ?
                                  'not-allowed' : 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5
                              }}
                            >
                              {isCollecting ? (
                                <>
                                  <span style={{
                                    animation: 'spin 0.7s linear infinite',
                                    display: 'inline-block'
                                  }}>⚙️</span>
                                  Working...
                                </>
                              ) : (
                                <>✓ Mark Collected</>
                              )}
                            </button>
                          )}
                          
                          {isDone && (
                            <span style={{
                              marginLeft: 'auto',
                              color: '#22c55e',
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}>
                              ✅ Collected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL — MAP */}
        <div style={{position: 'relative'}}>
          
          {/* Map overlay info */}
          <div style={{
            position: 'absolute',
            top: 12, left: 12,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: '0.78rem',
              color: '#e2e8f0',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: '#3b82f6',
                animation: 'pulse 1.5s ease infinite'
              }}/>
              Live Driver Map — {selectedVan}
            </div>
            
            {/* Legend */}
            <div style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: '0.72rem',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5
            }}>
              {[
                { color: '#3b82f6', label: 'Your location' },
                { color: '#22c55e', label: 'Collected stop' },
                { color: '#ef4444', label: 'Overflow bin' },
                { color: '#f97316', label: 'Complaint' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#94a3b8'
                }}>
                  <div style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: item.color,
                    flexShrink: 0
                  }}/>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <MapContainer
            center={driverLocation || DELHI_CENTER}
            zoom={13}
            style={{height: '100%', width: '100%'}}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Recenter on driver */}
            {driverLocation && (
              <RecenterMap position={driverLocation} />
            )}
            
            {/* Driver location */}
            {driverLocation && (
              <Marker 
                position={driverLocation} 
                icon={driverIcon}
              >
                <Popup>
                  <strong>🚛 {selectedVan}</strong><br/>
                  Your current location<br/>
                  <span style={{color:'#3b82f6'}}>
                    ● Live GPS
                  </span>
                </Popup>
              </Marker>
            )}
            
            {/* Route polyline from driver to remaining stops */}
            {routeCoords.length > 1 && (
              <>
                <Polyline
                  positions={routeCoords}
                  color="#000"
                  weight={5}
                  opacity={0.2}
                />
                <Polyline
                  positions={routeCoords}
                  color="#22c55e"
                  weight={3}
                  opacity={0.8}
                  dashArray="8,4"
                />
              </>
            )}
            
            {/* Stop markers */}
            {stops.map((stop, i) => (
              stop.lat && stop.lng && (
                <Marker
                  key={`stop-${i}`}
                  position={[stop.lat, stop.lng]}
                  icon={createBinIcon(
                    completedStops.includes(i) ?
                      'collected' : stop.status,
                    completedStops.includes(i) ? '✓' : i+1
                  )}
                  opacity={completedStops.includes(i) ? 0.5 : 1}
                >
                  <Popup>
                    <div style={{minWidth: 140}}>
                      <strong>
                        Stop #{i+1} — {stop.location}
                      </strong><br/>
                      Fill: {stop.fill_level}%<br/>
                      Status: {stop.status}<br/>
                      {completedStops.includes(i) && (
                        <span style={{color:'#22c55e',fontWeight:700}}>
                          ✅ Collected
                        </span>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
            
            {/* Complaint markers on map */}
            {nearbyComplaints.map(complaint => (
              complaint.lat && complaint.lng && (
                <Marker
                  key={`complaint-${complaint.id}`}
                  position={[complaint.lat, complaint.lng]}
                  icon={complaintIcon}
                >
                  <Popup>
                    <div style={{minWidth: 160}}>
                      <strong>⚠️ Complaint</strong><br/>
                      📍 {complaint.location}<br/>
                      📝 {complaint.description}<br/>
                      <span style={{
                        color: complaint.priority === 'high' ?
                          '#ef4444' : '#eab308',
                        fontWeight: 700
                      }}>
                        {complaint.priority === 'high' ?
                          '🔴 HIGH' : '🟡 NORMAL'} Priority
                      </span>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>

      <style>{`
        @keyframes driverPulse {
          0%,100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.1); }
        }
        @keyframes driverRipple {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes complaintPulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
