import { useState, useRef } from 'react';
import { FaPaperPlane, FaCamera, FaCheckCircle, FaBrain } from 'react-icons/fa';
import { submitReport, analyzeImage } from '../api';

export default function ReportForm({ onReportSubmitted }) {
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.trim()) return;
    setSubmitting(true);
    try {
      await submitReport(location, description || 'Garbage overflow reported');
      setSuccess('Complaint registered successfully!');
      setLocation('');
      setDescription('');
      setSelectedFile(null);
      setAiResult(null);
      onReportSubmitted();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file.name);
    setAnalyzing(true);
    setAiResult(null);
    try {
      const res = await analyzeImage(file);
      setAiResult(res.data);
    } catch (err) {
      setAiResult({ status: 'unknown', confidence: 0, ai_powered: false, error: true });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="sidebar-panel">
      <div className="section-header">
        <div className="section-title">
          <FaPaperPlane className="section-title-icon" />
          Report Issue
        </div>
      </div>

      <form className="report-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Location</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. Sector 3 - Near Park Gate"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            placeholder="Describe the waste issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Upload Image (AI Analysis)</label>
          <div className="file-upload-area" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} />
            <div className="file-upload-icon"><FaCamera /></div>
            <div className="file-upload-text">
              {selectedFile ? selectedFile : <><span>Click to upload</span> an image</>}
            </div>
          </div>
        </div>

        {analyzing && (
          <div className="loading-spinner" style={{ padding: '12px' }}>
            <div className="spinner"></div>
            <span className="loading-text">AI analyzing image...</span>
          </div>
        )}

        {aiResult && !aiResult.error && (
          <div className="ai-result">
            <div className="ai-result-header">
              <FaBrain /> AI Detection Result
            </div>
            <div className="ai-result-status" style={{
              color: aiResult.status === 'empty' ? 'var(--accent-green)' :
                     aiResult.status === 'half-full' ? 'var(--accent-yellow)' : 'var(--accent-red)'
            }}>
              {aiResult.status}
            </div>
            <div className="ai-result-detail">
              Confidence: {aiResult.confidence}% &nbsp;|&nbsp; 
              Fill Level: {aiResult.fill_level}% &nbsp;|&nbsp;
              {aiResult.ai_powered ? '🤖 YOLOv8' : '⚡ Simulated'}
            </div>
          </div>
        )}

        {success && (
          <div className="success-message">
            <FaCheckCircle /> {success}
          </div>
        )}

        <button className="btn-submit" type="submit" disabled={submitting || !location.trim()}>
          <FaPaperPlane />
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
