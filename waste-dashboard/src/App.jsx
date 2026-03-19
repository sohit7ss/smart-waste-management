import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Dustbins from './pages/Dustbins';
import Complaints from './pages/Complaints';
import Analytics from './pages/Analytics';
import RoutesPage from './pages/Routes';
import Alerts from './pages/Alerts';
import DriverView from './pages/DriverView';
import FleetTracker from './pages/FleetTracker';
import Layout from './components/Layout';

// Protected Route Wrapper
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (requiredRole && user.role !== 'admin' && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          
          <Route path="/dustbins" element={<ProtectedRoute requiredRole="admin"><Dustbins /></ProtectedRoute>} />
          
          <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
          
          <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>} />
          
          <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
          
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          
          <Route path="/driver" element={<ProtectedRoute><DriverView /></ProtectedRoute>} />
          
          <Route path="/fleet" element={<ProtectedRoute><FleetTracker /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
