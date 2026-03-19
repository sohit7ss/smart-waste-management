import { FaExclamationCircle, FaClipboardList } from 'react-icons/fa';

export default function ComplaintsList({ complaints }) {
  return (
    <div className="sidebar-panel">
      <div className="section-header">
        <div className="section-title">
          <FaClipboardList className="section-title-icon" />
          Recent Complaints
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {complaints.length} total
        </span>
      </div>

      {complaints.length === 0 ? (
        <div className="no-data">
          No complaints reported yet. Use the form below to report an issue.
        </div>
      ) : (
        <div className="complaints-list">
          {complaints.map((c) => (
            <div className="complaint-item" key={c.id}>
              <div className="complaint-icon">
                <FaExclamationCircle />
              </div>
              <div className="complaint-info">
                <div className="complaint-location">{c.location}</div>
                <div className="complaint-desc">{c.description}</div>
                <div className="complaint-time">{c.timestamp}</div>
              </div>
              <span className={`complaint-badge ${c.status}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
