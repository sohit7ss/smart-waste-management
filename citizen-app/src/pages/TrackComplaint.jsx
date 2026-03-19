import { useState } from 'react';
import axios from 'axios';

export default function TrackComplaint() {
  const [trackingId, setTrackingId] = useState('');
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const track = async () => {
    if (!trackingId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(
        `http://localhost:8000/complaints/${trackingId}`
      );
      setComplaint(res.data);
      setError('');
    } catch {
      setError('Complaint not found. Check your tracking ID.');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') track();
  };

  const statusColor = {
    pending: '#f59e0b',
    'in-progress': '#3b82f6',
    assigned: '#8b5cf6',
    resolved: '#22c55e'
  };

  const statusLabel = {
    pending: '⏳ Pending',
    'in-progress': '🔄 In Progress',
    assigned: '👷 Assigned',
    resolved: '✅ Resolved'
  };

  return (
    <div style={{
      maxWidth: '480px',
      margin: '40px auto',
      padding: '24px'
    }}>
      <h2 style={{ marginBottom: '8px' }}>🔍 Track Your Complaint</h2>
      <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px' }}>
        Enter your complaint ID to see its current status
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          value={trackingId}
          onChange={e => setTrackingId(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter complaint ID (e.g. 1)"
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid #334155',
            background: '#1e293b',
            color: 'white',
            fontSize: '15px',
            outline: 'none'
          }}
        />
        <button
          onClick={track}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 24px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {loading ? '...' : 'Track'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#1e293b',
          border: '1px solid #dc2626',
          borderRadius: '12px',
          padding: '16px',
          color: '#ef4444',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {complaint && (
        <div style={{
          background: '#1e293b',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #334155'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: 0 }}>Complaint #{complaint.id}</h3>
            <span style={{
              background: statusColor[complaint.status] || '#6b7280',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {statusLabel[complaint.status] || complaint.status}
            </span>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Location</div>
              <div style={{ fontWeight: '500' }}>📍 {complaint.location}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Description</div>
              <div>{complaint.description}</div>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Priority</div>
                <div style={{ 
                  color: complaint.priority === 'high' ? '#ef4444' : '#22c55e',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  {complaint.priority}
                </div>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Submitted</div>
                <div>{complaint.timestamp ? new Date(complaint.timestamp).toLocaleDateString() : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
