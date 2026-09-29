import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import WeatherData from './pages/WeatherData';
import AnomalyMonitoring from './pages/AnomalyMonitoring';
import StationDetail from './pages/StationDetail';
import Alerts from './pages/Alerts';
import ManualCheck from './pages/ManualCheck';
import About from './pages/About';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="/about" element={<About />} />
          </Routes>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}
