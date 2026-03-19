import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import MapView from './components/MapView';
import RoutePanel from './components/RoutePanel';
import ComplaintsList from './components/ComplaintsList';
import ReportForm from './components/ReportForm';
import { fetchDustbins, fetchComplaints, fetchOptimizedRoute } from './api';
import { FaExclamationTriangle } from 'react-icons/fa';

export default function App() {
  const [dustbins, setDustbins] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [route, setRoute] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [dustbinRes, complaintRes, routeRes] = await Promise.all([
        fetchDustbins(),
        fetchComplaints(),
        fetchOptimizedRoute(),
      ]);
      setDustbins(dustbinRes.data.dustbins || []);
      setComplaints(complaintRes.data.complaints || []);
      setRoute(routeRes.data);
      setError('');
    } catch (err) {
      setError('Cannot connect to backend at localhost:8000. Make sure the FastAPI server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <>
        <Header />
        <div className="loading-spinner" style={{ minHeight: '60vh' }}>
          <div className="spinner"></div>
          <span className="loading-text">Connecting to Smart Waste API...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />

      {error && (
        <div className="error-banner">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      <div className="dashboard">
        <StatsCards dustbins={dustbins} route={route} />

        <MapView dustbins={dustbins} route={route} showRoute={showRoute} />

        <div className="sidebar">
          <RoutePanel
            route={route}
            showRoute={showRoute}
            onToggleRoute={() => setShowRoute(!showRoute)}
          />
          <ComplaintsList complaints={complaints} />
          <ReportForm onReportSubmitted={loadData} />
        </div>
      </div>
    </>
  );
}
