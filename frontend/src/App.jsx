import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import WeatherData from './pages/WeatherData';
import AnomalyMonitoring from './pages/AnomalyMonitoring';
import StationDetail from './pages/StationDetail';
import Alerts from './pages/Alerts';
import ManualCheck from './pages/ManualCheck';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/weather" element={<WeatherData />} />
            <Route path="/anomalies" element={<AnomalyMonitoring />} />
            <Route path="/stations/:stationId" element={<StationDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/manual-check" element={<ManualCheck />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
