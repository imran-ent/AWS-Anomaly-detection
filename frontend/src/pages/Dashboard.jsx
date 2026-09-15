import { useEffect, useState } from 'react';
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
  BarChart,
  Bar,
} from 'recharts';
import {
  Radio,
  AlertTriangle,
  Bell,
  CheckCircle,
  TrendingUp,
  Activity,
  Zap,
  Database,
  BarChart3,
  Clock3,
  Layers,
  FlaskConical,
  Info,
  ShieldCheck,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { CountUpNumber } from '../components/CountUp';
import { getDashboardSummary, getAnomalyTrend, getDataQuality, getModelPerformance, getModelInfo, getPipeline } from '../services/api';
import { formatTime } from '../components/Badges';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
        }}
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
          {label}
        </p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: '3px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function StatCard({ icon: Icon, label, sub, value, subValue, iconBg, iconColor, accent, isText, delay }) {
  return (
    <motion.div
      className="stat-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={delay}
      style={{ '--card-accent': accent }}
    >
      <div className="stat-card-icon" style={{ background: iconBg }}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </div>
      <div className="stat-card-value">
        {isText ? (
          <span style={{ fontSize: 16, color: iconColor, fontWeight: 800, lineHeight: 1.2, display: 'block', wordBreak: 'break-word' }}>
            {value ?? '—'}
          </span>
        ) : (
          <CountUpNumber target={typeof value === 'number' ? value : 0} />
        )}
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-sub">{subValue ?? sub}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [dataQuality, setDataQuality] = useState(null);
  const [modelPerf, setModelPerf] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardSummary(), getAnomalyTrend(), getDataQuality(), getModelPerformance(), getModelInfo(), getPipeline()])
      .then(([s, t, dq, mp, mi, pl]) => {
        setSummary(s);
        setTrend(t);
        setDataQuality(dq);
        setModelPerf(mp);
        setModelInfo(mi);
        setPipeline(pl);
        if (s && s._isMock) setBackendError('Backend unavailable — showing DEMO DATA');
      })
      .catch((e) => setBackendError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const anomalyRate = summary && summary.totalRecords ? ((summary.anomaliesDetected / summary.totalRecords) * 100).toFixed(2) + '%' : '—';
  const lastUpdated = summary?.latestTimestamp ? formatTime(summary.latestTimestamp) : summary?.latestDate || '—';

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Historical AWS Anomaly Analysis Prototype — Near-real-time (Simulated Live Data)"
      />

      <div className="page-wrapper">
        {/* Hero — fixed real-time claim per Phase 21 */}
        <motion.div
          className="hero-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="hero-eyebrow">
            <Activity size={12} />
            Historical AWS Anomaly Analysis Prototype
          </div>
          <h1 className="hero-title">
            <span>AI/ML-Based Intelligent</span>
            <br />
            Anomaly Detection for AWS
          </h1>
          <p className="hero-tagline">
            Historical AWS anomaly analysis across {summary?.totalStations ?? '29'} Automatic Weather Stations using
            unsupervised Isolation Forest. Detects sensor faults & unusual weather patterns — backend is source of truth, frontend never re-decides anomaly.
            <span style={{ color: '#f97316', fontWeight: 700 }}> · Simulated Live Data</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> · Window: last 300 per station (8,700 rows) · Full dataset: 842,160 rows</span>
            {summary?._isMock && <span style={{ color: '#f97316', fontWeight: 700 }}> · DEMO DATA (backend offline)</span>}
            {summary?.dataset && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> · Dataset: {summary.dataset}</span>}
          </p>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Not real-time AWS streams · Not weather forecasting — pure anomaly detection. {summary?.dataset === 'injected' ? 'Evaluation uses synthetic labeled anomalies (see Model Performance).' : ''}
          </div>
        </motion.div>

        {/* Stat Cards — 6 per spec Phase 7 */}
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading dashboard…</span>
          </div>
        ) : (
          <>
            <div className="stat-cards-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatCard delay={0} icon={Database} label="Total Records" sub="In current window (300/station)" value={summary?.totalRecords} subValue={`${summary?.totalRecords?.toLocaleString?.() ?? summary?.totalRecords ?? '—'} / 842,160 full`} iconBg="var(--accent-cyan-dim)" iconColor="var(--accent-cyan)" accent="var(--accent-cyan)" />
              <StatCard delay={1} icon={Radio} label="Total Stations" sub="Across India (29 cities)" value={summary?.totalStations} subValue={`${summary?.totalStations ?? '—'} online · ${summary?.stationsOnline ?? summary?.totalStations ?? '—'} reporting`} iconBg="var(--accent-teal-dim)" iconColor="var(--accent-teal)" accent="var(--accent-teal)" />
              <StatCard delay={2} icon={AlertTriangle} label="Anomalies Detected" sub="ML flagged (window)" value={summary?.anomaliesDetected} subValue={`${summary?.highSeverity ?? 0} high · ${summary?.mediumSeverity ?? 0} medium · ${summary?.lowSeverity ?? 0} low`} iconBg="var(--status-high-dim)" iconColor="var(--status-high)" accent="var(--status-high)" />
              <StatCard delay={3} icon={BarChart3} label="Anomaly Rate" sub="Detected / window" value={anomalyRate} isText subValue={`Window rate · GT rate ~4.8% (injected)`} iconBg="var(--status-medium-dim)" iconColor="var(--status-medium)" accent="var(--status-medium)" />
              <StatCard delay={4} icon={ShieldCheck} label="Critical Anomalies" sub="Score ≥0.92 or forced" value={summary?.criticalSeverity} subValue={`${summary?.criticalSeverity ?? 0} critical · ${summary?.highSeverity ?? 0} high incl. critical`} iconBg="rgba(239,68,68,0.12)" iconColor="#ef4444" accent="#ef4444" />
              <StatCard delay={5} icon={Clock3} label="Last Updated" sub="Latest timestamp in window" value={lastUpdated} isText subValue={summary?.latestDate ?? '—'} iconBg="var(--status-normal-dim)" iconColor="var(--status-normal)" accent="var(--status-normal)" />
            </div>

            {/* Charts Row */}
            <div className="grid-2">
              {/* 7-day trend area chart */}
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.38 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <TrendingUp size={16} color="var(--accent-cyan)" />
                      7-Day Anomaly Trend
                    </div>
                    <div className="card-subtitle">
                      Anomalies detected per day by severity · Backend cache (5 min TTL)
                    </div>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#facc15" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--border-subtle)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 12, color: 'var(--text-secondary)' }}
                      />
                      <Area type="monotone" dataKey="high" name="High" stroke="#ef4444" strokeWidth={2} fill="url(#gradHigh)" />
                      <Area type="monotone" dataKey="medium" name="Medium" stroke="#f97316" strokeWidth={2} fill="url(#gradMedium)" />
                      <Area type="monotone" dataKey="low" name="Low" stroke="#facc15" strokeWidth={2} fill="url(#gradLow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Daily total bar chart */}
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.38 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <Zap size={16} color="var(--accent-teal)" />
                      Daily Anomaly Count
                    </div>
                    <div className="card-subtitle">Total anomalies per day (sum of severity tiers)</div>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#00b4a0" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="anomalies" name="Anomalies" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Quick Links — values traceable to backend summary */}
            <motion.div
              className="card mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
            >
              <div className="card-header">
                <div className="card-title">Quick Access</div>
                {backendError && <span style={{ fontSize: 11, color: '#f97316' }}>{backendError}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Live Weather Data', sub: `${summary?.totalStations ?? '—'} stations · ${summary?.totalRecords ?? '—'} records in window (synthesized wind/rainfall)`, to: '/weather', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)' },
                  { label: 'Anomaly Monitor', sub: `${summary?.anomaliesDetected ?? '—'} anomalies in current window · ${anomalyRate} rate`, to: '/anomalies', color: 'var(--status-high)', bg: 'var(--status-high-dim)' },
                  { label: 'Active Alerts', sub: `${summary?.activeAlerts ?? '—'} active alerts (High+Medium)`, to: '/alerts', color: 'var(--status-medium)', bg: 'var(--status-medium-dim)' },
                ].map((item) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    style={{
                      background: item.bg,
                      border: `1px solid ${item.color}33`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'transform var(--transition), box-shadow var(--transition)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${item.color}22`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.sub}</div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Data Quality Section — Phase 14 */}
            <motion.div className="card mt-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.35 }}>
              <div className="card-header">
                <div className="card-title"><Database size={16} color="var(--accent-cyan)" /> Data Quality</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Calculated from current window (not hardcoded)</span>
              </div>
              {dataQuality ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Raw Window</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 6 }}>{dataQuality.window?.raw_window_rows?.toLocaleString?.() ?? dataQuality.window?.raw_window_rows ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{dataQuality.window?.stations_in_window ?? '—'} stations · last 300/station</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Missing / Physical</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-medium)', marginTop: 6 }}>{dataQuality.window?.missing_values ?? '—'} missing · {dataQuality.window?.physical_range_violations ?? '—'} physical</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Missing = Communication Error · rate {((dataQuality.window?.missing_rate ?? 0)*100).toFixed(2)}%</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Valid Records</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--status-normal)', marginTop: 6 }}>{dataQuality.window?.valid_records?.toLocaleString?.() ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Valid rate {((dataQuality.window?.valid_rate ?? 0)*100).toFixed(1)}% · processed {dataQuality.window?.processed_rows ?? '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
                    Full dataset: <strong style={{ color: 'var(--text-secondary)' }}>{dataQuality.full_dataset?.total_rows?.toLocaleString?.() ?? '842,160'}</strong> hourly rows · <strong>{dataQuality.full_dataset?.total_stations ?? 29}</strong> stations · Injected anomalies <strong>{dataQuality.full_dataset?.injected_anomalies?.toLocaleString?.() ?? '42,108'}</strong> (5%, 10,527 per fault type). Window is subset for API latency (TTL 5 min).
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading data quality…</div>
              )}
            </motion.div>

            {/* Model Performance — Phase 15 */}
            <motion.div className="card mt-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.35 }}>
              <div className="card-header">
                <div>
                  <div className="card-title"><BarChart3 size={16} color="var(--accent-teal)" /> Model Performance</div>
                  <div className="card-subtitle">Evaluation on Synthetic Labeled Test Data (window 8,700) — NOT production accuracy</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: 99 }}>{modelPerf?.has_ground_truth ? 'Has Ground Truth' : 'No Ground Truth'}</span>
              </div>
              {modelPerf?.has_ground_truth ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Precision', value: modelPerf.metrics?.precision, sub: 'TP / (TP+FP)' },
                      { label: 'Recall', value: modelPerf.metrics?.recall, sub: 'TP / (TP+FN)' },
                      { label: 'F1 Score', value: modelPerf.metrics?.f1, sub: 'Harmonic mean' },
                      { label: 'Accuracy', value: modelPerf.metrics?.accuracy, sub: 'Misleading on imbalanced — see F1' },
                    ].map((m) => (
                      <div key={m.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{m.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: m.label === 'F1 Score' ? 'var(--accent-cyan)' : 'var(--text-primary)', marginTop: 6 }}>{m.value ?? '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Confusion Matrix</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontSize: 12 }}>
                        <div style={{ background: 'var(--status-normal-dim)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontWeight: 800, color: 'var(--status-normal)' }}>TN: {modelPerf.confusion_matrix?.tn ?? '—'}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal → Normal</div></div>
                        <div style={{ background: 'var(--status-high-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontWeight: 800, color: 'var(--status-high)' }}>FP: {modelPerf.confusion_matrix?.fp ?? '—'}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Normal → Anomaly</div></div>
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontWeight: 800, color: '#f97316' }}>FN: {modelPerf.confusion_matrix?.fn ?? '—'}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Anomaly → Normal</div></div>
                        <div style={{ background: 'var(--status-high-dim)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontWeight: 800, color: 'var(--status-high)' }}>TP: {modelPerf.confusion_matrix?.tp ?? '—'}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Anomaly → Anomaly</div></div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>FP {modelPerf.confusion_matrix?.fp ?? '—'} · FN {modelPerf.confusion_matrix?.fn ?? '—'} · Lower is better for safety</div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Per-Fault Recall</div>
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {modelPerf.per_fault_recall ? Object.entries(modelPerf.per_fault_recall).map(([k,v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 6 }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{k}</span>
                            <span style={{ color: v.recall === 1 ? 'var(--status-normal)' : v.recall < 0.1 ? 'var(--status-high)' : 'var(--status-medium)', fontWeight: 800 }}>{(v.recall*100).toFixed(1)}% ({v.detected}/{v.total})</span>
                          </div>
                        )) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No fault breakdown</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Drift low (1.7%) — honest limitation; Frozen/Comm 100%.</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 8, padding: '10px 12px' }}>
                    GT: {modelPerf.ground_truth?.anomaly ?? '—'} anomalies of {modelPerf.total_records ?? '—'} (rate {(modelPerf.ground_truth?.anomaly_rate*100 ?? 0).toFixed(1)}%) · ML predicted: {modelPerf.ml_detection?.predicted_anomaly ?? '—'} (rate {(modelPerf.ml_detection?.predicted_anomaly_rate*100 ?? 0).toFixed(1)}%) · Normal FPR {(modelPerf.normal_false_positives?.fpr*100 ?? 0).toFixed(1)}% — tradeoff: higher recall for safety, some FPs acceptable. <strong>Do not present as production accuracy.</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>No ground truth available in current window (clean dataset). Switch active dataset to injected (weather_data1.csv) to see evaluation. Injected window shows Precision/Recall/F1 above.</div>
              )}
            </motion.div>

            {/* Model Information — Phase 16 */}
            <motion.div className="card mt-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.35 }}>
              <div className="card-header">
                <div className="card-title"><FlaskConical size={16} color="var(--accent-cyan)" /> Model Information</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Truthful, from backend /api/model/info</span>
              </div>
              {modelInfo ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Model</div>
                    <div style={{ color: 'var(--text-primary)' }}>{modelInfo.model}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{modelInfo.primary_detector}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Learning: {modelInfo.learning_type}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Features ({modelInfo.feature_count})</div>
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{(modelInfo.features || []).join(', ')}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Training / Evaluation</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Training: {modelInfo.training_data}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Evaluation: {modelInfo.evaluation_data}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Anomaly Score</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{modelInfo.anomaly_score}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Threshold: {modelInfo.threshold_logic}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, color: '#f97316', marginBottom: 6 }}>Severity Logic (centralized)</div>
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                      forced critical ≥{modelInfo.severity_logic?.thresholds?.forced ?? '0.92'} else high · high ≥{modelInfo.severity_logic?.thresholds?.high ?? '0.88'} · medium ≥{modelInfo.severity_logic?.thresholds?.medium ?? '0.80'} else low · none if normal
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 11 }}>Backend is source of truth — frontend never decides severity. Score is NOT probability.</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading model info…</div>
              )}
            </motion.div>

            {/* System Pipeline UI — Phase 17 */}
            <motion.div className="card mt-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.35 }}>
              <div className="card-header">
                <div className="card-title"><Layers size={16} color="var(--accent-teal)" /> System Pipeline</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Backend is single source of truth</span>
              </div>
              {pipeline?.pipeline ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {pipeline.pipeline.map((step, idx) => (
                      <div key={step.step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', minWidth: 120, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: '0.06em' }}>STEP {step.step}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{step.title}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{step.desc}</div>
                        </div>
                        {idx < pipeline.pipeline.length - 1 && <span style={{ color: 'var(--accent-cyan)', fontSize: 14 }}>&darr;</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>{pipeline.note}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading pipeline…</div>
              )}
            </motion.div>

            {/* Limitations Footer */}
            <motion.div className="card mt-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.35 }} style={{ background: 'rgba(255,255,255,0.02)', borderStyle: 'dashed' }}>
              <div className="card-header">
                <div className="card-title"><Info size={16} color="var(--text-muted)" /> Known Limitations & Future Work</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <ul style={{ marginLeft: 16 }}>
                  <li><strong>Not 100% accurate</strong> — Drift recall ~1.7% (gradual offset inside rolling ±2σ); FPR ~7.5% (multivariate sensitivity). Honest tradeoff.</li>
                  <li><strong>Not real-time AWS streams</strong> — historical prototype (Kaggle/IMD hourly). For live, need MQTT/Kafka ingest + incremental scoring.</li>
                  <li><strong>Not forecasting or safety warnings</strong> — this is anomaly detection, not weather prediction.</li>
                  <li><strong>Per-batch score is relative</strong> — min-max rescaled per window, not absolute probability; do not display as "93% probability".</li>
                  <li>Future: station-specific thresholds, drift detector (CUSUM), SHAP explainability, online learning, missing-value imputation evaluation.</li>
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </>
  );
}
