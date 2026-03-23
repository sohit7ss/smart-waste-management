import React, { useState } from 'react';
import api from '../services/api';

export default function ReportForm() {
  const [formData, setFormData] = useState({
    location: '',
    description: '',
    priority: 'normal',
    lat: null,
    lng: null
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Using the public unauthenticated endpoint!
      const res = await api.post('/complaints/public', formData);
      setSuccess(res.data.id);
    } catch (err) {
      alert("Failed to submit report. Ensure the system is online.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData({
          ...formData, 
          location: `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  };

  if (success) {
    return (
      <div className="success-card">
        <div className="success-icon">✅</div>
        <h2>Report Submitted</h2>
        <p>Your issue has been logged with the municipal authorities. Thank you for keeping our city clean!</p>
        <p>Your tracking number:</p>
        <div className="ticket-id">#{success}</div>
        <button className="btn-secondary" onClick={() => { setSuccess(null); setFormData({location:'', description:'', priority:'normal', lat: null, lng: null}); }}>
          Report Another Issue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Location</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. Sector 4 Market, near Gate 2" 
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            required
          />
          <button type="button" className="btn-secondary" style={{ marginTop: 0 }} onClick={handleLocate}>
            📍
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Issue Description</label>
        <textarea 
          className="form-textarea" 
          placeholder="Describe the issue (e.g., bin is overflowing, garbage dumped on road)"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        ></textarea>
      </div>

      <div className="form-group">
        <label className="form-label">Urgency</label>
        <select 
          className="form-input"
          value={formData.priority}
          onChange={(e) => setFormData({...formData, priority: e.target.value})}
        >
          <option value="normal">Normal Priority</option>
          <option value="high">High Priority (Health Hazard / Blocking Traffic)</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Upload Photo (Optional)</label>
        <div className="upload-area">
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📷</div>
          <p>Tap to take a photo or upload an image</p>
          <input type="file" accept="image/*" />
        </div>
      </div>

      <button type="submit" className="btn-submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  );
}
