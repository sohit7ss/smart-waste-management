import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import ReportForm from './pages/ReportForm';
import TrackComplaint from './pages/TrackComplaint';

export default function App() {
  return (
    <Router>
      <div className="citizen-app">
        <header className="citizen-header">
          <div className="logo-area">
            <span className="logo-icon">🌿</span>
            <h1>CityWaste Portal</h1>
          </div>
          <p className="subtitle">Report local issues quickly & easily</p>
        </header>

        <nav className="citizen-nav">
          <NavLink to="/" end className={({isActive}) => isActive ? "nav-btn active" : "nav-btn"}>
            Report Issue
          </NavLink>
          <NavLink to="/track" className={({isActive}) => isActive ? "nav-btn active" : "nav-btn"}>
            Track Complaint
          </NavLink>
        </nav>

        <main className="citizen-main">
          <Routes>
            <Route path="/" element={<ReportForm />} />
            <Route path="/track" element={<TrackComplaint />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
