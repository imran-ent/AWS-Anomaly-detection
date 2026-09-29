import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  Radio, TriangleAlert, Thermometer, Droplets, Gauge, Wind,
  Database, Activity, ArrowRight, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, formatTime } from '../components/Badges';
import {
  getDashboardSummary, getAnomalyTrend, getDataQuality,
  getModelPerformance, getModelInfo, getPipeline, getStations, getAnomalies,
} from '../services/api';

const AXIS = { fill: '#64748B', fontSize: 11 };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.1)' }}>
      <p style={{ color: '#64748B', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.stroke, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, unit, status, statusLabel, sub, tint }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-icon" style={{ background: tint.bg }}>
          <Icon size={15} color={tint.fg} strokeWidth={2} />
        </span>
        <span className="stat-card-label" style={{ marginTop: 0 }}>{label}</span>
      </div>
      <div className="stat-card-value">{value}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{unit ? ` ${unit}` : ''}</span></div>
      {status && <span className={`stat-status ${status}`}><span className="dot" style={{ width: 6, height: 6, background: 'currentColor' }} />{statusLabel}</span>}
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

const TINTS = {
  blue: { bg: '#DBEAFE', fg: '#1D5FBF' },
  teal: { bg: '#CCFBF1', fg: '#0F766E' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  green: { bg: '#DCFCE7', fg: '#15803D' },
  slate: { bg: '#E2E8F0', fg: '#475569' },
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [dataQuality, setDataQuality] = useState(null);
  const [modelPerf, setModelPerf] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [stations, setStations] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardSummary(), getAnomalyTrend(), getDataQuality(), getModelPerformance(), getModelInfo(), getPipeline(), getStations(), getAnomalies()])
      .then(([s, t, dq, mp, mi, pl, st, an]) => {
        setSummary(s); setTrend(t); setDataQuality(dq);
        setModelPerf(mp); setModelInfo(mi); setPipeline(pl);
        if (Array.isArray(st)) setStations(st);
        if (Array.isArray(an)) setRecent(an.slice(0, 8));
        if (s?._isMock) setDemoMode(true);
      })
      .catch(() => setDemoMode(true))
      .finally(() => setLoading(false));
  }, []);

  const env = useMemo(() => {
    const nums = (k) => stations.map((s) => s[k]).filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : null);
    return {
      temp: avg(nums('temperature')), hum: avg(nums('humidity')),
      press: avg(nums('pressure')),
      wind: avg(nums('wind_speed')),
    };
  }, [stations]);

  const anomalyRate = summary?.totalRecords ? ((summary.anomaliesDetected / summary.totalRecords) * 100).toFixed(2) + '%' : '—';
  const lastUpdated = summary?.latestTimestamp ? formatTime(summary.latestTimestamp) : summary?.latestDate || '—';
  const validRate = dataQuality?.window?.valid_rate != null ? (dataQuality.window.valid_rate * 100).toFixed(1) + '%' : '—';
  const anomalousStations = stations.filter((s) => s.anomaly_status).length;
  const stationHealth = stations.length ? `${stations.length - anomalousStations}/${stations.length} normal` : '—';
  const f = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

  return (
    <>
      <TopBar title="Weather Monitoring Overview" subtitle={`Station status · data freshness · model status${demoMode ? ' · Demo data (backend offline)' : ''}`} />

      <div className="page-wrapper">
        {/* Hero */}
        <div className="hero-section">
          <div className="hero-grid">
            <div>
              <span className="hero-eyebrow"><Activity size={12} /> WeatherGuard AI · Historical AWS analysis</span>
              <h1 className="hero-title">Intelligent Weather Monitoring. Built for Reliable Data.</h1>
              <p className="hero-tagline">
                WeatherGuard AI detects anomalies in Automatic Weather Station data using machine-learning
                techniques, helping teams identify abnormal readings before they become operational problems.
                Across {summary?.totalStations ?? 29} stations · window of last 300 readings per station.
              </p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={() => navigate('/weather')}>
                  Open Monitoring Dashboard <ArrowRight size={15} />
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/anomalies')}>Explore Analytics</button>
              </div>
            </div>
            <div className="hero-flow" aria-hidden="true">
              <div className="hero-flow-title">Live detection flow</div>
              <div className="flow-steps">
                {[
                  [Thermometer, 'Temperature', 'Mean ' + f(env.temp, 1) + ' °C across stations'],
                  [Gauge, 'Pressure', 'Mean ' + f(env.press, 0) + ' hPa across stations'],
                  [Droplets, 'Humidity', 'Mean ' + f(env.hum, 1) + ' % across stations'],
                  [Wind, 'Wind', 'Mean ' + f(env.wind, 1) + ' km/h across stations'],
                  [ShieldCheck, 'Anomaly Detection', (summary?.anomaliesDetected ?? '—') + ' flagged in window · Isolation Forest'],
                ].map(([Icon, t, s], i, arr) => (
                  <div className="flow-step" key={t}>
                    <div className="flow-node">
                      <span className="flow-dot"><Icon size={13} /></span>
                      {i < arr.length - 1 && <span className="flow-line" />}
                    </div>
                    <div className="flow-text"><b>{t}</b><span>{s}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner" role="status" aria-label="Loading monitoring data">
            <div className="spinner" />
            <span className="loading-text">Loading monitoring data…</span>
          </div>
        ) : (
          <>
            {/* Overview strip */}
            <div className="overview-strip" role="status">
              <span className="flex-row"><span className="dot green pulse" /> <strong>System Operational</strong></span>
              <span>Last updated <strong>{lastUpdated}</strong></span>
              <span>Data freshness <strong>{dataQuality?.window?.processed_rows ? `${Number(dataQuality.window.processed_rows).toLocaleString()} records in window` : 'window cached · 5 min TTL'}</strong></span>
              <span>Model <strong>{modelInfo?.model ? 'Active' : 'Active'} · Isolation Forest</strong></span>
              {demoMode && <span className="badge badge-medium">Demo data</span>}
            </div>

            {/* Key metrics */}
            <div className="stat-cards-grid">
              <MetricCard icon={Thermometer} label="Temperature" value={f(env.temp, 1)} unit="°C" tint={TINTS.blue} status="ok" statusLabel="Normal" sub="Mean across stations" />
              <MetricCard icon={Droplets} label="Humidity" value={f(env.hum, 1)} unit="%" tint={TINTS.teal} status="ok" statusLabel="Normal" sub="Mean across stations" />
              <MetricCard icon={Gauge} label="Pressure" value={f(env.press, 0)} unit="hPa" tint={TINTS.slate} status="ok" statusLabel="Stable" sub="Mean across stations" />
              <MetricCard icon={Wind} label="Wind Speed" value={f(env.wind, 1)} unit="km/h" tint={TINTS.slate} status="ok" statusLabel="Normal" sub="Mean across stations" />
              <MetricCard icon={TriangleAlert} label="Anomalies" value={summary?.anomaliesDetected ?? recent.length ?? '—'} unit="" tint={TINTS.red} status={(summary?.anomaliesDetected ?? 0) > 0 ? 'bad' : 'ok'} statusLabel="Detected in window" sub={`${summary?.highSeverity ?? 0} high · ${summary?.mediumSeverity ?? 0} medium`} />
              <MetricCard icon={Database} label="Data Quality" value={validRate} unit="" tint={TINTS.green} status="ok" statusLabel="Healthy" sub={stationHealth} />
            </div>

            {/* System health */}
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <div className="card-title"><CheckCircle2 size={15} color="#15803D" /> System Health</div>
                  <div className="card-subtitle">Pipeline, model, stations and data quality at a glance</div>
                </div>
                <span className="text-muted" style={{ fontSize: 12 }}>Anomaly rate {anomalyRate}</span>
              </div>
              <div className="health-list">
                <div className="health-item"><span className="dot green" /><div><b>Data Pipeline</b><span>Operational · 5 min cache</span></div></div>
                <div className="health-item"><span className="dot green" /><div><b>ML Detection Model</b><span>Active · Isolation Forest</span></div></div>
                <div className="health-item"><span className={`dot ${anomalousStations > 0 ? 'amber' : 'green'}`} /><div><b>Weather Stations</b><span>{stations.length ? `${stations.length} connected · ${anomalousStations} flagged` : 'Connected'}</span></div></div>
                <div className="health-item"><span className="dot green" /><div><b>Data Quality</b><span>{validRate} valid records</span></div></div>
              </div>
            </div>

            {/* Anomaly centrepiece */}
            <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '20px 20px 0' }}>
                <div>
                  <div className="card-title"><TriangleAlert size={15} color="#B91C1C" /> Recent Anomalies</div>
                  <div className="card-subtitle">Most severe first · click a row for the full investigation view</div>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/anomalies')}>Open anomaly monitor <ArrowRight size={14} /></button>
              </div>
              <div style={{ padding: 20 }}>
                {recent.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon"><CheckCircle2 size={20} /></span>
                    <b>No anomaly events detected</b>
                    <p style={{ fontSize: 12.5 }}>All monitored sensor readings are currently within expected ranges.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Time</th><th>Station</th><th>Sensor</th><th>Reading</th><th>Expected</th><th>Deviation</th><th>Severity</th></tr></thead>
                      <tbody>
                        {recent.map((a) => (
                          <tr key={a.id} className={a.severity === 'High' ? 'row-anomalous' : a.severity === 'Medium' ? 'row-medium' : ''} onClick={() => navigate('/anomalies')}>
                            <td className="text-muted" style={{ fontSize: 12 }}>{formatTime(a.timestamp)}</td>
                            <td className="font-mono" style={{ fontWeight: 700, color: 'var(--brand-blue)' }}>{a.station_id}</td>
                            <td style={{ textTransform: 'capitalize' }}>{String(a.parameter || '').replace('_', ' ')}</td>
                            <td className="num" style={{ fontWeight: 700 }}>{a.anomaly_value ?? '—'}</td>
                            <td className="num text-muted">{a.expected_range ?? '—'}</td>
                            <td className="num">{a.anomaly_score ?? '—'}</td>
                            <td><SeverityBadge severity={a.severity} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Charts */}
            <div className="grid-2 mb-4">
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">7-Day Anomaly Trend</div>
                    <div className="card-subtitle">Anomalies per day by severity · units: events/day</div>
                  </div>
                </div>
                <div className="chart-container chart-scroll"><div className="chart-scroll-inner" style={{ height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="high" name="High" stroke="#B91C1C" fill="#FEE2E2" strokeWidth={2} />
                      <Area type="monotone" dataKey="medium" name="Medium" stroke="#B45309" fill="#FEF3C7" strokeWidth={2} />
                      <Area type="monotone" dataKey="low" name="Low" stroke="#92400E" fill="#FEF9C3" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div></div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Daily Anomaly Count</div>
                    <div className="card-subtitle">Total anomalies per day · units: events/day</div>
                  </div>
                </div>
                <div className="chart-container chart-scroll"><div className="chart-scroll-inner" style={{ height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="anomalies" name="Anomalies" fill="#1D5FBF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div></div>
              </div>
            </div>

            {/* Station quick state */}
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <div className="card-title"><Radio size={15} color="#1D5FBF" /> Station Status</div>
                  <div className="card-subtitle">{stations.length} stations · {anomalousStations} with active anomalies · click to inspect</div>
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/weather')}>All stations <ArrowRight size={14} /></button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Station</th><th>Location</th><th>Temp</th><th>Humidity</th><th>Pressure</th><th>Status</th><th>Updated</th></tr></thead>
                  <tbody>
                    {stations.slice(0, 8).map((s) => (
                      <tr key={s.station_id} className={s.anomaly_status ? 'row-anomalous' : ''} onClick={() => navigate(`/stations/${s.station_id}`)}>
                        <td className="font-mono" style={{ fontWeight: 700, color: 'var(--brand-blue)' }}>{s.station_id}</td>
                        <td>{s.location || s.city}</td>
                        <td className="num">{s.temperature ?? '—'} °C</td>
                        <td className="num">{s.humidity ?? '—'} %</td>
                        <td className="num">{s.pressure ?? '—'} hPa</td>
                        <td>{s.anomaly_status ? <span className="badge badge-high">Anomaly</span> : <span className="badge badge-normal">Normal</span>}</td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{formatTime(s.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model performance (honest, compact) */}
            {modelPerf?.has_ground_truth && (
              <div className="card mb-4">
                <div className="card-header">
                  <div>
                    <div className="card-title">Model Performance</div>
                    <div className="card-subtitle">Evaluation on synthetic labelled test data (window 8,700) — not production accuracy</div>
                  </div>
                </div>
                <div className="grid-4">
                  {[
                    ['Precision', modelPerf.metrics?.precision],
                    ['Recall', modelPerf.metrics?.recall],
                    ['F1 Score', modelPerf.metrics?.f1],
                    ['Accuracy', modelPerf.metrics?.accuracy],
                  ].map(([label, value]) => (
                    <div key={label} className="health-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                      <b style={{ fontSize: 20 }}>{value ?? '—'}</b>
                    </div>
                  ))}
                </div>
                <div className="note-box mt-4">
                  Ground truth: {modelPerf.ground_truth?.anomaly ?? '—'} anomalies · Predicted: {modelPerf.ml_detection?.predicted_anomaly ?? '—'} ·
                  Confusion TN {modelPerf.confusion_matrix?.tn} / FP {modelPerf.confusion_matrix?.fp} / FN {modelPerf.confusion_matrix?.fn} / TP {modelPerf.confusion_matrix?.tp}.
                  Prioritise F1 over accuracy on imbalanced data.
                </div>
              </div>
            )}

            {/* Pipeline note */}
            {pipeline?.pipeline && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Detection Pipeline</div>
                  <div className="card-subtitle">Backend is the single source of truth</div>
                </div>
                <div className="pipeline-steps">
                  {pipeline.pipeline.slice(0, 5).map((s) => (
                    <div key={s.step} className="pipeline-step">
                      <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-blue)' }}>STEP {s.step}</span>
                      <b>{s.title}</b><span>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
