import React, { useState, useEffect } from 'react';
import { complaintAPI } from '../services/api';
import './TableStyles.css';

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await complaintAPI.getAll();
      setComplaints(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resolveComplaint = async (id) => {
    try {
      await complaintAPI.update(id, { status: 'resolved' });
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert('Action failed.');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="page-container">
      <div className="section-header">
        <h2 className="section-title">💬 Citizen Reports Queue</h2>
      </div>
      
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Location</th>
              <th>Issue</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map(comp => (
              <tr key={comp.id}>
                <td>#{comp.id}</td>
                <td>{comp.location}</td>
                <td className="desc-cell">{comp.description}</td>
                <td>
                  <span className={`priority-badge ${comp.priority}`}>
                    {comp.priority}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${comp.status}`}>
                    {comp.status}
                  </span>
                </td>
                <td>{new Date(comp.timestamp).toLocaleString()}</td>
                <td>
                  {comp.status !== 'resolved' && (
                    <button className="btn-action resolve" onClick={() => resolveComplaint(comp.id)}>
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center">No reports in the queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
