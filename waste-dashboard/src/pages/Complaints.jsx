import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all');
  const [wasteFilter, setWasteFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchComplaints();
    setupWebSocket();
    
    // Auto refresh every 15 seconds as backup
    const interval = setInterval(fetchComplaints, 15000);
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(
        'http://localhost:8000/complaints/',
        { headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }}
      );
      setComplaints(res.data);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Complaints fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('✅ Complaints WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 WS message:', data.type);
        
        // New complaint from Firebase
        if (data.type === 'new_complaint') {
          setComplaints(prev => {
            // Check not already in list
            const exists = prev.find(
              c => c.id === data.complaint.id ||
              c.firestore_id === data.complaint.firestore_id
            );
            if (exists) return prev;
            console.log('✅ New complaint added to list');
            return [data.complaint, ...prev];
          });
          setLastSync(new Date().toLocaleTimeString());
        }
        
        // Status update
        if (data.type === 'complaint_update') {
          setComplaints(prev => prev.map(c =>
            c.id === data.complaint.id 
              ? { ...c, status: data.complaint.status }
              : c
          ));
        }

        // AI Classification update
        if (data.type === 'complaint_classified') {
          setComplaints(prev => prev.map(c => 
            c.id === data.complaint_id
              ? { 
                  ...c, 
                  waste_category: data.waste_category,
                  waste_confidence: data.waste_confidence,
                  waste_scanned: true
                }
              : c
          ));
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };
    
    ws.onerror = (e) => console.error('WS error:', e);
    
    ws.onclose = () => {
      console.log('🔄 WS closed, reconnecting...');
      setTimeout(setupWebSocket, 3000);
    };
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await axios.post(
        'http://localhost:8000/sync/firebase',
        {},
        { headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }}
      );
      await fetchComplaints();
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualScan = async (complaintId) => {
    try {
      await axios.post(
        `http://localhost:8000/complaints/${complaintId}/scan`,
        {},
        { headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }}
      );
    } catch (err) {
      console.error('Scan failed:', err);
    }
  };

  const handleResolve = async (complaintId, firestoreId) => {
    try {
      await axios.patch(
        `http://localhost:8000/complaints/${complaintId}/resolve`,
        {},
        { headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }}
      );
      // Update locally immediately
      setComplaints(prev => prev.map(c =>
        c.id === complaintId ? { ...c, status: 'resolved' } : c
      ));
    } catch (err) {
      console.error('Resolve failed:', err);
    }
  };

  // Filter complaints
  const filtered = complaints.filter(c => {
    const statusMatch = filter === 'all' || c.status === filter;
    const wasteMatch = wasteFilter === 'all' || 
      (c.waste_category && c.waste_category.toLowerCase() === wasteFilter);
    return statusMatch && wasteMatch;
  });

  const counts = {
    all: complaints.length,
    pending: complaints.filter(c => c.status === 'pending').length,
    assigned: complaints.filter(c => c.status === 'assigned').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div style={{ padding: '24px' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <div>
          <h1 style={{ 
            margin: 0, fontSize: '1.3rem', 
            fontWeight: 800, color: '#f1f5f9' 
          }}>
            📋 Citizen Reports Queue
          </h1>
          <div style={{ 
            display: 'flex', alignItems: 'center', 
            gap: 8, marginTop: 4 
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 1.5s ease infinite'
            }}/>
            <span style={{ 
              color: '#22c55e', 
              fontSize: '0.75rem',
              fontWeight: 600 
            }}>
              Live — Auto-syncing from Firebase
            </span>
            {lastSync && (
              <span style={{ color: '#475569', fontSize: '0.72rem' }}>
                · Last: {lastSync}
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={handleManualSync}
          disabled={syncing}
          style={{
            background: syncing ? '#374151' : '#f97316',
            color: 'white',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 8,
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          {syncing ? '🔄 Syncing...' : '🔥 Refresh Now'}
        </button>
      </div>

      {/* Status Filter tabs */}
      <div style={{ 
        display: 'flex', gap: 8, marginBottom: 10 
      }}>
        {['all', 'pending', 'assigned', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: filter === f ? 
                '#22c55e' : 'rgba(255,255,255,0.1)',
              background: filter === f ? 
                'rgba(34,197,94,0.12)' : 'transparent',
              color: filter === f ? '#22c55e' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Waste Type Filter tabs */}
      <div style={{ 
        display: 'flex', gap: 8, marginBottom: 20 
      }}>
        {['all', 'organic', 'recyclable', 'hazardous', 'dry'].map(f => (
          <button
            key={f}
            onClick={() => setWasteFilter(f)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: wasteFilter === f ? 
                '#3b82f6' : 'rgba(255,255,255,0.1)',
              background: wasteFilter === f ? 
                'rgba(59,130,246,0.12)' : 'transparent',
              color: wasteFilter === f ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {f === 'all' ? 'All Types' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        overflow: 'hidden'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse' 
        }}>
          <thead>
            <tr style={{ 
              borderBottom: '1px solid rgba(255,255,255,0.07)' 
            }}>
              {['ID','LOCATION','ISSUE','PRIORITY',
                'WASTE TYPE','STATUS','SOURCE','IMAGE','TIME','ACTIONS'
              ].map(h => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '0.7rem',
                  color: '#475569',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ 
                  textAlign: 'center', 
                  padding: 40, 
                  color: '#64748b' 
                }}>
                  Loading complaints...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ 
                  textAlign: 'center', 
                  padding: 40, 
                  color: '#64748b' 
                }}>
                  No {filter === 'all' ? '' : filter} complaints
                </td>
              </tr>
            ) : (
              filtered.map(complaint => (
                <tr 
                  key={complaint.id}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => 
                    e.currentTarget.style.background = 
                    'rgba(255,255,255,0.02)'
                  }
                  onMouseLeave={e => 
                    e.currentTarget.style.background = 'transparent'
                  }
                >
                  {/* ID */}
                  <td style={{ 
                    padding: '12px 16px',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    fontFamily: 'monospace'
                  }}>
                    #{String(complaint.firestore_id || complaint.id)
                      .slice(0, 8)}
                  </td>
                  
                  {/* Location */}
                  <td style={{ 
                    padding: '12px 16px',
                    fontSize: '0.82rem',
                    color: '#e2e8f0',
                    maxWidth: 200
                  }}>
                    {complaint.location}
                  </td>
                  
                  {/* Issue */}
                  <td style={{ 
                    padding: '12px 16px',
                    fontSize: '0.82rem',
                    color: '#94a3b8',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {complaint.description || '—'}
                  </td>
                  
                  {/* Priority */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      color: complaint.priority === 'high' ? 
                        '#ef4444' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: complaint.priority === 'high' ? 
                        700 : 400
                    }}>
                      {complaint.priority || 'normal'}
                    </span>
                  </td>
                  
                  {/* Waste Type (AI Scanned) */}
                  <td style={{ padding: '12px 16px' }}>
                    {complaint.waste_scanned ? (
                      <div>
                        <div style={{
                          background: complaint.waste_category === 'organic' ? 'rgba(34,197,94,0.15)' :
                                      complaint.waste_category === 'recyclable' ? 'rgba(59,130,246,0.15)' :
                                      complaint.waste_category === 'hazardous' ? 'rgba(239,68,68,0.15)' :
                                      'rgba(168,162,158,0.15)',
                          color: complaint.waste_category === 'organic' ? '#22c55e' :
                                 complaint.waste_category === 'recyclable' ? '#3b82f6' :
                                 complaint.waste_category === 'hazardous' ? '#ef4444' : '#a8a29e',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          display: 'inline-block',
                          marginBottom: 4
                        }}>
                          {complaint.waste_category || 'UNKNOWN'}
                        </div>
                        <div style={{ 
                          width: '100%', height: 4, 
                          background: 'rgba(255,255,255,0.1)', 
                          borderRadius: 2 
                        }}>
                          <div style={{ 
                            width: `${complaint.waste_confidence || 0}%`, 
                            height: '100%', 
                            background: '#3b82f6', 
                            borderRadius: 2 
                          }}/>
                        </div>
                        <div style={{fontSize: '0.6rem', color: '#64748b', marginTop: 2}}>
                          {Math.round(complaint.waste_confidence || 0)}% Conf.
                        </div>
                      </div>
                    ) : complaint.image_url ? (
                      <button
                        onClick={() => handleManualScan(complaint.id)}
                        style={{
                          background: 'rgba(59,130,246,0.1)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59,130,246,0.3)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🤖 Scan AI
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No Image</span>
                    )}
                  </td>
                  
                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: 
                        complaint.status === 'resolved' ?
                          'rgba(34,197,94,0.15)' :
                        complaint.status === 'assigned' ?
                          'rgba(59,130,246,0.15)' :
                          'rgba(234,179,8,0.15)',
                      color:
                        complaint.status === 'resolved' ?
                          '#22c55e' :
                        complaint.status === 'assigned' ?
                          '#3b82f6' : '#eab308',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {complaint.status}
                    </span>
                  </td>
                  
                  {/* Source */}
                  <td style={{ padding: '12px 16px' }}>
                    {complaint.firestore_id ? (
                      <span style={{
                        background: 'rgba(249,115,22,0.15)',
                        color: '#f97316',
                        border: '1px solid rgba(249,115,22,0.3)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.68rem',
                        fontWeight: 700
                      }}>
                        🔥 Firebase
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(99,102,241,0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.3)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.68rem',
                        fontWeight: 700
                      }}>
                        🖥️ Dashboard
                      </span>
                    )}
                  </td>
                  
                  {/* Image */}
                  <td style={{ padding: '12px 16px' }}>
                    {complaint.image_url ? (
                      <img
                        src={complaint.image_url}
                        alt="complaint"
                        style={{
                          width: 44, height: 44,
                          objectFit: 'cover',
                          borderRadius: 6,
                          cursor: 'pointer',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        onClick={() => window.open(
                          complaint.image_url, '_blank'
                        )}
                        onError={e => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span style={{ 
                        color: '#334155', 
                        fontSize: '0.75rem' 
                      }}>—</span>
                    )}
                  </td>
                  
                  {/* Time */}
                  <td style={{ 
                    padding: '12px 16px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    whiteSpace: 'nowrap'
                  }}>
                    {complaint.timestamp ? 
                      new Date(complaint.timestamp)
                        .toLocaleString() : '—'}
                  </td>
                  
                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    {complaint.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolve(
                          complaint.id, 
                          complaint.firestore_id
                        )}
                        style={{
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.3)',
                          padding: '5px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
