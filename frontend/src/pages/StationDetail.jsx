import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MapPin,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  Gauge,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Navigation,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, StatusBadge, formatTime } from '../components/Badges';
import { getStationById, getStationHistory, getAnomalies } from '../services/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
        }}
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
          {label}
        </p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const READINGS = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, color: 'var(--accent-cyan)' },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: Droplets, color: '#60a5fa' },
  { key: 'rainfall', label: 'Rainfall', unit: 'mm', icon: CloudRain, color: '#818cf8' },
  { key: 'wind_speed', label: 'Wind Speed', unit: 'km/h', icon: Wind, color: '#34d399' },
  { key: 'pressure', label: 'Pressure', unit: 'hPa', icon: Gauge, color: '#fb923c' },
];

const CHART_LINES = [
  { key: 'temperature', name: 'Temp (°C)', color: '#00d4ff', yAxis: 'left' },
  { key: 'humidity', name: 'Humidity (%)', color: '#60a5fa', yAxis: 'right' },
  { key: 'rainfall', name: 'Rainfall (mm)', color: '#818cf8', yAxis: 'right' },
  { key: 'wind_speed', name: 'Wind (km/h)', color: '#34d399', yAxis: 'right' },
];

function formatHour(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export default function StationDetail() {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLines, setActiveLines] = useState({
    temperature: true,
    humidity: true,
    rainfall: false,
    wind_speed: false,
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getStationById(stationId),
      getStationHistory(stationId),
      getAnomalies(stationId),
    ])
      .then(([s, h, a]) => {
        setStation(s);
        setHistory(h);
        setAnomalies(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [stationId]);

  const historyFormatted = history.map((h) => ({
    ...h,
    time: formatHour(h.time),
  }));

  if (loading) {
    return (
      <>
        <TopBar title={`Station ${stationId}`} />
        <div className="page-wrapper">
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading station data…</span>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Station Not Found" />
        <div className="page-wrapper">
          <div className="error-state">
            <p>⚠ {error}</p>
            <button
              onClick={() => navigate('/weather')}
              style={{
                marginTop: 16,
                padding: '8px 20px',
                background: 'var(--accent-cyan-dim)',
                border: '1px solid var(--glass-border)',
                borderRadius: 8,
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              ← Back to Stations
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title={`${station.location} — ${station.station_id}`}
        subtitle={`${station.state} · Elevation ${station.elevation}m`}
      />

      <div className="page-wrapper">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            transition: 'color var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={15} />
          Back to Stations
        </button>

        {/* Top Row: Info Card + Readings */}
        <div className="station-detail-grid">
          {/* Info Panel */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                {station.location}
              </h2>
              <StatusBadge anomalyStatus={station.anomaly_status} />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <MapPin size={13} color="var(--accent-cyan)" />
              {station.latitude}°N, {station.longitude}°E
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                padding: 14,
                fontSize: 12,
                lineHeight: 2,
              }}
            >
              {[
                ['Station ID', station.station_id],
                ['State', station.state],
                ['Elevation', `${station.elevation} m`],
                ['Wind Direction', station.wind_direction],
                ['Pressure', `${station.pressure} hPa`],
                ['Last Updated', formatTime(station.timestamp)],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>

            {station.anomaly_status && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'var(--status-high-dim)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  fontSize: 12,
                  color: 'var(--status-high)',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Active anomaly detected. {anomalies.length} anomaly record
                  {anomalies.length !== 1 ? 's' : ''} for this station today.
                </span>
              </div>
            )}

            {!station.anomaly_status && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'var(--status-normal-dim)',
                  border: '1px solid rgba(0,200,150,0.25)',
                  borderRadius: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--status-normal)',
                }}
              >
                <CheckCircle size={14} />
                All readings within normal range.
              </div>
            )}
          </motion.div>

          {/* Readings Panel */}
          <motion.div
            className="card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="card-header">
              <div className="card-title">
                <Navigation size={15} color="var(--accent-teal)" />
                Current Sensor Readings
              </div>
            </div>

            <div className="readings-grid">
              {READINGS.map((r) => {
                const Icon = r.icon;
                const value = station[r.key];
                return (
                  <div className="reading-item" key={r.key}>
                    <div style={{ marginBottom: 8 }}>
                      <Icon size={18} color={r.color} />
                    </div>
                    <div className="reading-value" style={{ color: r.color }}>
                      {value}
                    </div>
                    <div className="reading-unit">{r.unit}</div>
                    <div className="reading-label">{r.label}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* 24-hr History Chart */}
        <motion.div
          className="card mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">24-Hour Sensor History</div>
              <div className="card-subtitle">
                Hourly readings for {station.location} on{' '}
                {new Date(station.timestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
            {/* Toggle buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {CHART_LINES.map((l) => (
                <button
                  key={l.key}
                  onClick={() =>
                    setActiveLines((prev) => ({ ...prev, [l.key]: !prev[l.key] }))
                  }
                  style={{
                    padding: '4px 10px',
                    borderRadius: 99,
                    border: `1px solid ${l.color}`,
                    background: activeLines[l.key] ? `${l.color}22` : 'transparent',
                    color: activeLines[l.key] ? l.color : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  {l.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {historyFormatted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No history data available for this station.
            </div>
          ) : (
            <div className="chart-container-tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickLine={false}
                    interval={historyFormatted.length > 12 ? 2 : 1}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 10 }}
                  />
                  {CHART_LINES.map((l) =>
                    activeLines[l.key] ? (
                      <Line
                        key={l.key}
                        yAxisId={l.yAxis}
                        type="monotone"
                        dataKey={l.key}
                        name={l.name}
                        stroke={l.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Anomaly History for this Station */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <div className="card-header">
            <div className="card-title">
              <AlertTriangle size={15} color="var(--status-high)" />
              Anomaly History — {station.station_id}
            </div>
            <span
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            >
              {anomalies.length} record{anomalies.length !== 1 ? 's' : ''}
            </span>
          </div>

          {anomalies.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 0',
                color: 'var(--status-normal)',
                fontSize: 13,
              }}
            >
              <CheckCircle size={24} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              No anomalies recorded for this station.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Anomaly Value</th>
                    <th>Expected Range</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => (
                    <tr
                      key={a.id || i}
                      className={
                        a.severity === 'High'
                          ? 'row-anomalous'
                          : a.severity === 'Medium'
                          ? 'row-medium'
                          : ''
                      }
                    >
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                        {a.parameter.replace('_', ' ')}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 15,
                            color:
                              a.severity === 'High'
                                ? 'var(--status-high)'
                                : a.severity === 'Medium'
                                ? 'var(--status-medium)'
                                : 'var(--status-low)',
                          }}
                        >
                          {a.anomaly_value}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {a.expected_range}
                      </td>
                      <td>
                        <SeverityBadge severity={a.severity} />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatTime(a.timestamp)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                        {a.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
