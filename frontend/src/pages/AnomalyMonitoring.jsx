import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Filter,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, formatTime } from '../components/Badges';
import { getAnomalies, getAnomalyTrend, getDashboardSummary, getStations } from '../services/api';

const PARAMETER_LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  rainfall: 'Rainfall',
  wind_speed: 'Wind Speed',
  pressure: 'Pressure',
  multivariate: 'Multivariate Pattern',
};

const DETECTION_LABELS = {
  UNIVARIATE: 'Univariate',
  MULTIVARIATE: 'Multivariate',
  SENSOR_STUCK: 'Sensor Stuck',
  COMMUNICATION: 'Comm Error',
  PHYSICAL_RANGE: 'Physical Range',
  NORMAL: 'Normal',
};

const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p) => (<p key={p.name} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>))}
      </div>
    );
  }
  return null;
};

function DetailModal({ anomaly, onClose }) {
  if (!anomaly) return null;
  const isMultivariate = anomaly.detection_type === 'MULTIVARIATE' || anomaly.parameter === 'multivariate' || anomaly.detection_type === 'SENSOR_STUCK' || anomaly.detection_type === 'COMMUNICATION';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, maxWidth: 520, width: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Anomaly Details — {anomaly.id} · {anomaly.station_id}</div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 6, cursor: 'pointer' }}><X size={14} color="var(--text-muted)" /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Station / Time</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{anomaly.station_id} · {PARAMETER_LABELS[anomaly.parameter] || anomaly.parameter}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(anomaly.timestamp)}</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Anomaly Score / Severity</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: anomaly.severity === 'High' ? 'var(--status-high)' : 'var(--status-medium)', marginTop: 4 }}>{anomaly.anomaly_score}</div>
              <div style={{ marginTop: 4 }}><SeverityBadge severity={anomaly.severity} /></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Observed</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--status-high)', marginTop: 4 }}>{anomaly.anomaly_value ?? 'N/A'} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isMultivariate ? '' : anomaly.parameter}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isMultivariate ? 'N/A for multivariate' : 'Actual sensor value'}</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Expected Range</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, fontFamily: 'monospace' }}>{anomaly.expected_range}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isMultivariate ? 'Multivariate — no single range' : 'Rolling mean ±2σ (window 5)'}</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reason</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{anomaly.explanation || anomaly.description || '—'}</div>
            {isMultivariate && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>Value is within individual expected range, but combined pattern is unusual (IsolationForest).</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>GT: <strong style={{ color: anomaly.ground_truth_label === 'Anomaly' ? 'var(--status-high)' : 'var(--status-normal)' }}>{anomaly.ground_truth_label ?? 'N/A'}</strong> {anomaly.ground_truth_fault_type && anomaly.ground_truth_fault_type !== 'Normal' ? `(${anomaly.ground_truth_fault_type})` : ''}</span>
            <span>·</span>
            <span>ML: <strong style={{ color: anomaly.ml_label === 'Anomaly' ? 'var(--status-high)' : 'var(--status-normal)' }}>{anomaly.ml_label ?? '—'}</strong> ({anomaly.predicted_fault_type})</span>
            <span>·</span>
            <span>{anomaly.detection_type}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function AnomalyMonitoring() {
  const [anomalies, setAnomalies] = useState([]);
  const [stations, setStations] = useState([]);
  const [trend, setTrend] = useState([]);
  const [totalAnomalies, setTotalAnomalies] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [stationFilter, setStationFilter] = useState('All');
  const [paramFilter, setParamFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('severity');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const perPage = 20;
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getAnomalies(), getAnomalyTrend(), getDashboardSummary(), getStations()])
      .then(([a, t, summary, st]) => {
        const sorted = [...a].sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
        setAnomalies(sorted);
        setTrend(t);
        if (summary && typeof summary.anomaliesDetected === 'number') setTotalAnomalies(summary.anomaliesDetected);
        else if (summary && typeof summary.totalAnomalies === 'number') setTotalAnomalies(summary.totalAnomalies);
        if (summary && summary._isMock) setIsMock(true);
        if (a && a._isMock) setIsMock(true);
        if (Array.isArray(st)) setStations(st);
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const filtered = useMemo(() => {
    let out = [...anomalies];
    if (severityFilter !== 'All') out = out.filter((a) => a.severity === severityFilter);
    if (stationFilter !== 'All') out = out.filter((a) => a.station_id === stationFilter);
    if (paramFilter !== 'All') out = out.filter((a) => a.parameter === paramFilter);
    if (timeFilter !== 'All') {
      const cutoff = new Date(now);
      if (timeFilter === '24h') cutoff.setHours(cutoff.getHours() - 24);
      else if (timeFilter === '7d') cutoff.setDate(cutoff.getDate() - 7);
      else if (timeFilter === '30d') cutoff.setDate(cutoff.getDate() - 30);
      out = out.filter((a) => new Date(a.timestamp) >= cutoff);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((a) => `${a.station_id} ${a.parameter} ${a.description} ${a.predicted_fault_type}`.toLowerCase().includes(q));
    }
    // sorting
    if (sortBy === 'severity') out.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
    else if (sortBy === 'timestamp') out.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
    else if (sortBy === 'score') out.sort((x, y) => y.anomaly_score - x.anomaly_score);
    return out;
  }, [anomalies, severityFilter, stationFilter, paramFilter, timeFilter, search, sortBy]);

  // reset page when filters change
  useEffect(() => setPage(1), [severityFilter, stationFilter, paramFilter, timeFilter, search, sortBy]);

  const highCount = anomalies.filter((a) => a.severity === 'High').length;
  const medCount = anomalies.filter((a) => a.severity === 'Medium').length;
  const lowCount = anomalies.filter((a) => a.severity === 'Low').length;

  const pageCount = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);
  const rowClass = (sev) => (sev === 'High' ? 'row-anomalous' : sev === 'Medium' ? 'row-medium' : '');

  return (
    <>
      <TopBar title="Anomaly Monitoring" subtitle={`${totalAnomalies !== null ? totalAnomalies : anomalies.length} total anomalies${isMock ? ' · DEMO DATA' : ''} · ${highCount} high severity · Simulated historical window`} />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Anomaly Records</h1>
              <p>All anomalies detected by the ML model across all stations. Sorted by severity. Click a row for full explanation (actual vs expected, score, severity, reason).</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-high">{highCount} High</span>
              <span className="badge badge-medium">{medCount} Medium</span>
              <span className="badge badge-low">{lowCount} Low</span>
              {totalAnomalies !== null && anomalies.length < totalAnomalies && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Showing {anomalies.length} of {totalAnomalies} (limit 100) — use API limit for more</span>
              )}
              {isMock && <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700 }}>DEMO DATA</span>}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading anomaly data…</span></div>
        ) : (
          <>
            <motion.div className="card mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="card-header">
                <div>
                  <div className="card-title"><TrendingUp size={16} color="var(--accent-cyan)" />7-Day Severity Breakdown</div>
                  <div className="card-subtitle">Anomaly counts per severity tier over the past week · From /api/anomalies/trend</div>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#facc15" stopOpacity={0.25} /><stop offset="95%" stopColor="#facc15" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 10 }} />
                    <Area type="monotone" dataKey="high" name="High" stroke="#ef4444" strokeWidth={2.5} fill="url(#gHigh)" />
                    <Area type="monotone" dataKey="medium" name="Medium" stroke="#f97316" strokeWidth={2} fill="url(#gMed)" />
                    <Area type="monotone" dataKey="low" name="Low" stroke="#facc15" strokeWidth={1.5} fill="url(#gLow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Filters: Station, Parameter, Time, Severity, Search, Sort */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
              <Filter size={14} color="var(--text-muted)" />
              {/* Station */}
              <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
                <option value="All">All Stations</option>
                {stations.map((s) => (<option key={s.station_id} value={s.station_id}>{s.station_id} · {s.city || s.location}</option>))}
              </select>
              {/* Parameter */}
              <select value={paramFilter} onChange={(e) => setParamFilter(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
                <option value="All">All Parameters</option>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="pressure">Pressure</option>
                <option value="multivariate">Multivariate</option>
              </select>
              {/* Time */}
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
                <option value="All">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              {/* Severity */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['All','High','Medium','Low'].map((f) => (
                  <button key={f} onClick={() => setSeverityFilter(f)} style={{ padding: '5px 12px', borderRadius: 99, border: `1px solid ${severityFilter===f ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: severityFilter===f ? 'var(--accent-cyan-dim)' : 'transparent', color: severityFilter===f ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{f}</button>
                ))}
              </div>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search station, param, fault…" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px 7px 32px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
              </div>
              {/* Sort */}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
                <option value="severity">Sort: Severity</option>
                <option value="timestamp">Sort: Recent</option>
                <option value="score">Sort: Score</option>
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Showing {filtered.length} · Page {page}/{pageCount || 1}</span>
            </div>

            {/* Table */}
            <motion.div className="card" style={{ padding: 0 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Station ID</th>
                      <th>Parameter</th>
                      <th>Anomaly Value</th>
                      <th>Expected Range <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, color: 'var(--text-muted)' }}>(rolling ±2σ or N/A)</span></th>
                      <th>Detection Type</th>
                      <th>Severity</th>
                      <th>GT</th>
                      <th>ML</th>
                      <th><div className="flex-row" style={{ gap: 5 }}><Clock size={11} />Timestamp</div></th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((anomaly, i) => {
                      const isMultivariate = anomaly.detection_type === 'MULTIVARIATE' || anomaly.parameter === 'multivariate' || anomaly.detection_type === 'SENSOR_STUCK' || anomaly.detection_type === 'COMMUNICATION';
                      const idx = (page-1)*perPage + i + 1;
                      return (
                      <motion.tr key={anomaly.id} className={rowClass(anomaly.severity)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }} onClick={() => setSelected(anomaly)} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{idx}</td>
                        <td><span className="font-mono text-cyan" style={{ fontSize: 13, fontWeight: 700 }}>{anomaly.station_id}</span></td>
                        <td>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }} title={isMultivariate ? 'Multivariate pattern' : 'Univariate outside expected range'}>{PARAMETER_LABELS[anomaly.parameter] || anomaly.parameter}{isMultivariate && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> (pattern)</span>}</span>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>score {anomaly.anomaly_score}</div>
                        </td>
                        <td>{isMultivariate ? (<span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>N/A</span>) : (<span style={{ fontWeight: 800, fontSize: 15, color: anomaly.severity === 'High' ? 'var(--status-high)' : anomaly.severity === 'Medium' ? 'var(--status-medium)' : 'var(--status-low)' }}>{anomaly.anomaly_value}</span>)}</td>
                        <td><span style={{ fontSize: 12, color: isMultivariate ? 'var(--text-muted)' : 'var(--text-secondary)', fontFamily: 'monospace', fontStyle: isMultivariate ? 'italic' : 'normal' }}>{anomaly.expected_range}</span></td>
                        <td><span className={`badge ${isMultivariate ? 'badge-medium' : 'badge-high'}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>{DETECTION_LABELS[anomaly.detection_type] || anomaly.detection_type || '—'}</span></td>
                        <td><SeverityBadge severity={anomaly.severity} /></td>
                        <td><span style={{ fontSize: 11, fontWeight: 600, color: anomaly.ground_truth_label === 'Anomaly' ? 'var(--status-high)' : anomaly.ground_truth_label === 'Normal' ? 'var(--status-normal)' : 'var(--text-muted)' }}>{anomaly.ground_truth_label || 'N/A'}</span></td>
                        <td><span style={{ fontSize: 11, fontWeight: 600, color: anomaly.ml_label === 'Anomaly' ? 'var(--status-high)' : 'var(--status-normal)' }}>{anomaly.ml_label || (anomaly.ml_is_anomaly ? 'Anomaly' : 'Normal')}</span><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{anomaly.predicted_fault_type}</div></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTime(anomaly.timestamp)}</td>
                        <td><button onClick={(e) => { e.stopPropagation(); setSelected(anomaly); }} style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>View</button></td>
                      </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>No anomalies match current filters.</div>}
              {/* Pagination */}
              {pageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p-1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: page<=1 ? 'var(--bg-elevated)' : 'var(--accent-cyan-dim)', color: page<=1 ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: page<=1?'not-allowed':'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={14} />Prev</button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} of {pageCount} · {filtered.length} records (20 per page)</span>
                  <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p+1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: page>=pageCount ? 'var(--bg-elevated)' : 'var(--accent-cyan-dim)', color: page>=pageCount ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: page>=pageCount?'not-allowed':'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Next<ChevronRight size={14} /></button>
                </div>
              )}
            </motion.div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong>Univariate</strong>: single parameter outside its rolling expected range (mean ±2σ, window 5 per station). Shows exact param, value, range. <strong>Multivariate / Sensor Stuck / Comm Error</strong>: individual values may be normal but combined pattern is unusual (IsolationForest + rules). Shows <code>N/A — Multivariate Detection</code>. GT = injected dataset label, ML = model prediction. Severity from <code>anomaly_score</code>: High ≥0.88 or forced, Medium ≥0.80, Low otherwise. <strong>Click View</strong> for full explanation (Phase 9).
            </div>
          </>
        )}
        {selected && <DetailModal anomaly={selected} onClose={() => setSelected(null)} />}
      </div>
    </>
  );
}
