import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import WeatherData from './pages/WeatherData';
import AnomalyMonitoring from './pages/AnomalyMonitoring';
import StationDetail from './pages/StationDetail';
import Alerts from './pages/Alerts';
import ManualCheck from './pages/ManualCheck';
import Analyze from './pages/Analyze';
import About from './pages/About';
import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page-wrapper">
      <div className="card not-found-card" role="alert">
        <div className="card-title">Page not found</div>
        <p className="card-subtitle">The route you requested does not exist. Use the navigation above or return to the dashboard.</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/">Back to Dashboard</Link>
          <Link className="btn btn-secondary" to="/anomalies">Open Anomaly Monitor</Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-layout">
        <Navbar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/weather" element={<WeatherData />} />
            <Route path="/anomalies" element={<AnomalyMonitoring />} />
            <Route path="/stations/:stationId" element={<StationDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/manual-check" element={<ManualCheck />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}
