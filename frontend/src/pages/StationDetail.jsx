import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
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
  Info,
  X,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, StatusBadge, formatTime } from '../components/Badges';
import { getStationById, getStationHistory, getAnomalies, BASE_URL } from '../services/api';

const READINGS = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, color: 'var(--accent-cyan)' },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: Droplets, color: '#60a5fa' },
  { key: 'rainfall', label: 'Rainfall', unit: 'mm', icon: CloudRain, color: '#818cf8' },
  { key: 'wind_speed', label: 'Wind Speed', unit: 'km/h', icon: Wind, color: '#34d399' },
  { key: 'pressure', label: 'Pressure', unit: 'hPa', icon: Gauge, color: '#fb923c' },
];

function formatHour(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

// Custom tooltip that shows expected/bounds + anomaly flag
const HistoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 11, maxWidth: 280 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{label} — {row?.timestamp ? new Date(row.timestamp).toLocaleDateString('en-IN') : ''}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value ?? '—'}</strong></div>
      ))}
      {row?.is_anomaly && (
        <div style={{ marginTop: 6, padding: '6px 8px', background: 'var(--status-high-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--status-high)', fontSize: 11 }}>
          <strong>ANOMALY</strong> · score {row.anomaly_score} · {row.severity} · {row.detection_type}
          <div style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{row.explanation}</div>
        </div>
      )}
      {!row?.is_anomaly && row?.expected != null && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>Expected {row.expected} · Range {row.lower}–{row.upper} · Normal</div>
      )}
    </div>
  );
};

function AnomalyDetailModal({ anomaly, onClose }) {
  if (!anomaly) return null;
  // anomaly from AnomalyMonitoring has shape with expected_range string, plus display_parameter etc
  // But StationDetail anomalies come from getAnomalies(stationId) same shape
  // For detailed view we fetch /api/anomalies/{id} if needed; but quick display from passed object
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 520, width: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color="var(--status-high)" /> Anomaly Details — {anomaly.station_id} · {anomaly.id}</div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 6, cursor: 'pointer' }}><X size={14} color="var(--text-muted)" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Observed</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--status-high)', marginTop: 4 }}>{anomaly.anomaly_value ?? 'N/A'} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{anomaly.parameter}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Actual value from sensor</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Expected Range</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, fontFamily: 'monospace' }}>{anomaly.expected_range}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Rolling mean ±2σ (window 5) or N/A for multivariate</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Anomaly Score</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: anomaly.anomaly_score >= 0.8 ? 'var(--status-high)' : 'var(--status-medium)', marginTop: 4 }}>{anomaly.anomaly_score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>IsolationForest per-batch [0,1] — not probability</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Severity · Status</div>
              <div style={{ marginTop: 6 }}><SeverityBadge severity={anomaly.severity} /></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{anomaly.detection_type} · {anomaly.predicted_fault_type}</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reason</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{anomaly.explanation || anomaly.description || '—'}</div>
            {anomaly.detection_type === 'MULTIVARIATE' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>Value is within individual expected range, but combined pattern is unusual (multivariate).</div>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            Station {anomaly.station_id} · {formatTime(anomaly.timestamp)} · GT: {anomaly.ground_truth_label ?? 'N/A'} ({anomaly.ground_truth_fault_type ?? ''}) · ML: {anomaly.ml_label ?? anomaly.severity} · Sensor health: {anomaly.sensor_health_status ?? '—'}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function StationDetail() {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedParam, setSelectedParam] = useState('temperature');
  const [hours, setHours] = useState(24);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);

  const loadHistory = (param, h) => {
    // Use direct fetch to include parameter bounds
    const url = `${BASE_URL}/api/stations/${stationId}/history?hours=${h}&parameter=${param}`;
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`History fetch failed ${r.status}`);
      return r.json();
    });
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getStationById(stationId),
      loadHistory(selectedParam, hours),
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

  // reload history when param/hours changes
  useEffect(() => {
    if (!station) return;
    loadHistory(selectedParam, hours).then(setHistory).catch(() => {});
  }, [selectedParam, hours]);

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
            <button onClick={() => navigate('/weather')} style={{ marginTop: 16, padding: '8px 20px', background: 'var(--accent-cyan-dim)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 13 }}>← Back to Stations</button>
          </div>
        </div>
      </>
    );
  }

  const paramMeta = { temperature: { label: 'Temperature', unit: '°C', color: '#00d4ff' }, humidity: { label: 'Humidity', unit: '%', color: '#60a5fa' }, pressure: { label: 'Pressure', unit: 'hPa', color: '#fb923c' } };

  return (
    <>
      <TopBar title={`${station.location} — ${station.station_id}`} subtitle={`${station.state} · Elevation ${station.elevation}m · Simulated historical window`} />

      <div className="page-wrapper">
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, cursor: 'pointer', background: 'none', border: 'none', transition: 'color var(--transition)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}><ArrowLeft size={15} />Back to Stations</button>

        <div className="station-detail-grid">
          <motion.div className="glass-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{station.location}</h2>
              <StatusBadge anomalyStatus={station.anomaly_status} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}><MapPin size={13} color="var(--accent-cyan)" />{station.latitude}°N, {station.longitude}°E</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 14, fontSize: 12, lineHeight: 2 }}>
              {[
                ['Station ID', station.station_id],
                ['State', station.state],
                ['Elevation', `${station.elevation} m`],
                ['Wind Direction', station.wind_direction],
                ['Pressure', `${station.pressure} hPa`],
                ['Last Updated', formatTime(station.timestamp)],
                ['ML Severity', station.severity ?? 'none'],
                ['Sensor Health', station.sensor_health_status ?? '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>
            {station.anomaly_status ? (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--status-high-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--status-high)' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Active anomaly detected. {anomalies.length} anomaly record{anomalies.length !== 1 ? 's' : ''} for this station in window.</span>
              </div>
            ) : (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--status-normal-dim)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--status-normal)' }}><CheckCircle size={14} />All readings within normal range for this parameter window.</div>
            )}
          </motion.div>

          <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
            <div className="card-header"><div className="card-title"><Navigation size={15} color="var(--accent-teal)" />Current Sensor Readings</div></div>
            <div className="readings-grid">
              {READINGS.map((r) => {
                const Icon = r.icon;
                const value = station[r.key];
                return (
                  <div className="reading-item" key={r.key}>
                    <div style={{ marginBottom: 8 }}><Icon size={18} color={r.color} /></div>
                    <div className="reading-value" style={{ color: r.color }}>{value}</div>
                    <div className="reading-unit">{r.unit}</div>
                    <div className="reading-label">{r.label}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Enhanced Time-Series Graph with expected/bounds + anomaly points — Phase 8 */}
        <motion.div className="card mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Sensor History — {paramMeta[selectedParam].label} (Actual vs Expected)</div>
              <div className="card-subtitle">Actual value ●, expected baseline (rolling mean, window 5) — dashed, bounds ±2σ, anomalies highlighted · Hourly for {station.location}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {['temperature','humidity','pressure'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedParam(p)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 99,
                    border: `1px solid ${selectedParam === p ? paramMeta[p].color : 'var(--border-subtle)'}`,
                    background: selectedParam === p ? `${paramMeta[p].color}22` : 'transparent',
                    color: selectedParam === p ? paramMeta[p].color : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {p}
                </button>
              ))}
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
              {[24, 72, 168].map((h) => (
                <button key={h} onClick={() => setHours(h)} style={{ padding: '4px 10px', borderRadius: 99, border: `1px solid ${hours===h ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: hours===h ? 'var(--accent-cyan-dim)' : 'transparent', color: hours===h ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{h===24?'24H':h===72?'3D':'7D'}</button>
              ))}
            </div>
          </div>

          {historyFormatted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>No history data available for this station.</div>
          ) : (
            <div className="chart-container-tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyFormatted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} interval={historyFormatted.length > 24 ? Math.floor(historyFormatted.length/12) : 2} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} domain={['auto','auto']} />
                  <Tooltip content={<HistoryTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 10 }} />
                  {/* Bounds area */}
                  <Line type="monotone" dataKey="upper" name="Upper Bound" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="lower" name="Lower Bound" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="expected" name="Expected (rolling mean)" stroke="#9ca3af" strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="actual" name={`Actual ${paramMeta[selectedParam].label}`} stroke={paramMeta[selectedParam].color} strokeWidth={2} dot={({ cx, cy, payload }) => payload?.is_anomaly ? <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} /> : <circle cx={cx} cy={cy} r={2} fill={paramMeta[selectedParam].color} />} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>How to read:</strong> Solid colored line = actual sensor value; dashed grey = expected (rolling mean, window 5); dotted lines = expected ±2σ bounds. Red dots = ML-flagged anomalies (is_anomaly=True). Click anomaly table row for detail. If a point is inside bounds but flagged, UI explains: "combined pattern is unusual (multivariate)".
          </div>
        </motion.div>

        {/* Anomaly History for this Station — clickable to detail */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}>
          <div className="card-header">
            <div className="card-title"><AlertTriangle size={15} color="var(--status-high)" />Anomaly History — {station.station_id}</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{anomalies.length} record{anomalies.length !== 1 ? 's' : ''} · Click row for details</span>
          </div>

          {anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--status-normal)', fontSize: 13 }}><CheckCircle size={24} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />No anomalies recorded for this station in window.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Anomaly Value</th>
                    <th>Expected Range</th>
                    <th>Detection</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => (
                    <tr key={a.id || i} className={a.severity === 'High' ? 'row-anomalous' : a.severity === 'Medium' ? 'row-medium' : ''} onClick={() => setSelectedAnomaly(a)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{a.parameter.replace('_', ' ')} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>score {a.anomaly_score}</span></td>
                      <td><span style={{ fontWeight: 800, fontSize: 15, color: a.severity === 'High' ? 'var(--status-high)' : a.severity === 'Medium' ? 'var(--status-medium)' : 'var(--status-low)' }}>{a.anomaly_value ?? 'N/A'}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{a.expected_range}</td>
                      <td><span className="badge badge-medium" style={{ fontSize: 10 }}>{a.detection_type ?? '—'}</span></td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(a.timestamp)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220 }}>{a.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
        {selectedAnomaly && <AnomalyDetailModal anomaly={selectedAnomaly} onClose={() => setSelectedAnomaly(null)} />}
      </div>
    </>
  );
}
