import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  Radio, TriangleAlert, Database, Activity, ArrowRight,
  CheckCircle2, ShieldCheck, UploadCloud, Gauge,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, formatTime } from '../components/Badges';
import { KpiCard, TINTS, DashboardSkeleton, NoAnomalies } from '../components/ui';
import {
  getDashboardSummary, getAnomalyTrend, getDataQuality,
  getModelPerformance, getModelInfo, getPipeline, getStations, getAnomalies,
} from '../services/api';

const AXIS = { fill: '#718096', fontSize: 11 };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(120,160,220,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 28px rgba(37,99,235,0.14)' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.stroke, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

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
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getDashboardSummary(), getAnomalyTrend(), getDataQuality(), getModelPerformance(), getModelInfo(), getPipeline(), getStations(), getAnomalies()])
      .then((results) => {
        if (cancelled) return;
        const [s, t, dq, mp, mi, pl, st, an] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
        if (s) { setSummary(s); if (s?._isMock) setDemoMode(true); }
        if (t) setTrend(Array.isArray(t) ? t : t?.trend ?? []);
        if (dq) setDataQuality(dq);
        if (mp) setModelPerf(mp);
        if (mi) setModelInfo(mi);
        if (pl) setPipeline(pl);
        if (Array.isArray(st)) setStations(st);
        if (Array.isArray(an)) setRecent(an.slice(0, 8));
        if (!s && !st && !an) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const env = useMemo(() => {
    const nums = (k) => stations.map((s) => s[k]).filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { temp: avg(nums('temperature')), hum: avg(nums('humidity')), press: avg(nums('pressure')) };
  }, [stations]);

  const total = summary?.totalRecords ?? null;
  const anomalies = summary?.anomaliesDetected ?? recent.length ?? null;
  const normal = total != null && anomalies != null ? total - anomalies : null;
  const rate = total ? ((anomalies / total) * 100).toFixed(2) + '%' : '—';
  const validRate = dataQuality?.window?.valid_rate != null ? (dataQuality.window.valid_rate * 100).toFixed(1) + '%' : '—';
  const lastUpdated = summary?.latestTimestamp ? formatTime(summary.latestTimestamp) : summary?.latestDate || '—';
  const anomalousStations = stations.filter((s) => s.anomaly_status).length;
  const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString());

  return (
    <>
      <TopBar title="Weather Monitoring Overview" subtitle={`Station status · data freshness · model status${demoMode ? ' · Demo data (backend offline)' : ''}`} status={demoMode ? 'demo' : 'operational'} />

      <div className="page-wrapper">
        {/* HERO */}
        <div className="hero-section">
          <div className="hero-grid">
            <div>
              <span className="hero-eyebrow"><Activity size={12} /> AI-Powered Weather Monitoring</span>
              <h1 className="hero-title">Intelligent Weather Monitoring <span>&amp; Anomaly Detection</span></h1>
              <p className="hero-tagline">
                Upload weather station data and let WeatherGuard AI identify unusual patterns, sensor deviations, and potential anomalies — across {summary?.totalStations ?? 29} stations.
              </p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={() => navigate('/analyze')}>
                  <UploadCloud size={16} /> Upload CSV
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/weather')}>
                  Open Monitoring Dashboard <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <div className="card" style={{ background: 'rgba(255,255,255,0.55)', position: 'relative', zIndex: 1 }}>
              <div className="card-title" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1D4ED8' }}>Live detection flow</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
                {[
                  [`Temperature`, env.temp != null ? `${env.temp.toFixed(1)} °C mean` : '—'],
                  [`Pressure`, env.press != null ? `${env.press.toFixed(0)} hPa mean` : '—'],
                  [`Humidity`, env.hum != null ? `${env.hum.toFixed(1)} % mean` : '—'],
                  [`Anomaly Detection`, `${fmtInt(anomalies)} flagged · Isolation Forest`],
                ].map(([t, s], i, arr) => (
                  <div key={t} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: i === arr.length - 1 ? '#DC2626' : '#2563EB' }} />
                      {i < arr.length - 1 && <span style={{ width: 1, height: 16, background: '#D8E2F2' }} />}
                    </div>
                    <div style={{ paddingBottom: 12 }}>
                      <b style={{ display: 'block', fontSize: 12.5 }}>{t}</b>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : failed ? (
          <div className="card"><div className="error-state" role="alert"><b>Unable to retrieve monitoring data</b>Check that the backend is running at the configured API URL, then try again.<div className="retry-row"><button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button></div></div></div>
        ) : (
          <>
            <div className="overview-strip" role="status">
              <span className="flex-row"><span className="dot green pulse" /> <strong>System Operational</strong></span>
              <span>Last updated <strong>{lastUpdated}</strong></span>
              <span>Window <strong>{total != null ? `${fmtInt(total)} records · 300/station` : 'cached · 5 min TTL'}</strong></span>
              <span>Model <strong>Active · Isolation Forest</strong></span>
              {demoMode && <span className="badge badge-medium">Demo data</span>}
            </div>

            {/* KPI CARDS — only real metrics */}
            <div className="stat-cards-grid">
              <KpiCard icon={Database} label="Total Records" value={fmtInt(total)} sub="In current window" tint={TINTS.blue} />
              <KpiCard icon={TriangleAlert} label="Anomalies Detected" value={fmtInt(anomalies)} sub={`${summary?.highSeverity ?? 0} high · ${summary?.mediumSeverity ?? 0} medium`} tint={TINTS.red} />
              <KpiCard icon={CheckCircle2} label="Normal Readings" value={fmtInt(normal)} sub="Window minus flagged" tint={TINTS.green} />
              <KpiCard icon={Gauge} label="Anomaly Rate" value={rate} sub="Detected / window" tint={TINTS.amber} />
              <KpiCard icon={ShieldCheck} label="Data Quality" value={validRate} sub={`${stations.length - anomalousStations}/${stations.length || '—'} stations normal`} tint={TINTS.cyan} />
            </div>

            {/* MAIN ANOMALY CHART */}
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <div className="card-title">Anomaly Analysis</div>
                  <div className="card-subtitle">Anomalies detected per day by severity · units: events/day</div>
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/anomalies')}>Explore Analytics <ArrowRight size={14} /></button>
              </div>
              {trend?.length ? (
                <div className="chart-container chart-scroll"><div className="chart-scroll-inner" style={{ height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="dHigh" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={0.22} /><stop offset="95%" stopColor="#DC2626" stopOpacity={0} /></linearGradient>
                        <linearGradient id="dMed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18} /><stop offset="95%" stopColor="#D97706" stopOpacity={0} /></linearGradient>
                        <linearGradient id="dLow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0284C7" stopOpacity={0.18} /><stop offset="95%" stopColor="#0284C7" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF2" />
                      <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: '#E5EAF2' }} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="high" name="High" stroke="#DC2626" strokeWidth={2.5} fill="url(#dHigh)" dot={false} activeDot={{ r: 5, fill: '#DC2626' }} />
                      <Area type="monotone" dataKey="medium" name="Medium" stroke="#D97706" strokeWidth={2.5} fill="url(#dMed)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="low" name="Low" stroke="#0284C7" strokeWidth={2.5} fill="url(#dLow)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div></div>
              ) : (
                <NoAnomalies lastChecked={lastUpdated} />
              )}
            </div>

            <div className="grid-2 mb-4">
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Daily Anomaly Count</div>
                    <div className="card-subtitle">Total anomalies per day · units: events/day</div>
                  </div>
                </div>
                <div className="chart-container chart-scroll"><div className="chart-scroll-inner" style={{ height: '100%' }}>
                  {trend?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <defs>
                        <linearGradient id="dBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF2" vertical={false} />
                      <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: '#E5EAF2' }} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                      <Bar dataKey="anomalies" name="Anomalies" fill="url(#dBar)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  ) : (
                    <NoAnomalies lastChecked={lastUpdated} />
                  )}
                </div></div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title"><CheckCircle2 size={15} color="#15803D" /> System Health</div>
                </div>
                <div className="health-list cols-2">
                  <div className="health-item"><span className="dot green" /><div><b>Data Pipeline</b><span>Operational · 5 min cache</span></div></div>
                  <div className="health-item"><span className="dot green" /><div><b>ML Detection Model</b><span>Active · Isolation Forest</span></div></div>
                  <div className="health-item"><span className={`dot ${anomalousStations > 0 ? 'amber' : 'green'}`} /><div><b>Weather Stations</b><span>{stations.length} connected · {anomalousStations} flagged</span></div></div>
                  <div className="health-item"><span className="dot green" /><div><b>Data Quality</b><span>{validRate} valid records</span></div></div>
                </div>
                {modelInfo && (
                  <div className="note-box mt-4" style={{ fontSize: 12 }}>
                    {modelInfo.model || 'Isolation Forest (200 trees, contamination 0.02)'} · {modelInfo.feature_count || 18} features ·
                    trained on normal behaviour, evaluated on labelled faults.
                  </div>
                )}
              </div>
            </div>

            {/* RECENT ANOMALIES */}
            <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '22px 22px 0' }}>
                <div>
                  <div className="card-title"><TriangleAlert size={15} color="#DC2626" /> Recent Anomalies</div>
                  <div className="card-subtitle">Timestamp · sensor · observed · expected · score · severity</div>
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/anomalies')}>Open anomaly monitor <ArrowRight size={14} /></button>
              </div>
              <div style={{ padding: 22 }}>
                {recent.length === 0 ? (
                  <NoAnomalies lastChecked={lastUpdated} />
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Timestamp</th><th>Sensor</th><th>Observed</th><th>Expected</th><th>Score</th><th>Severity</th><th>Status</th></tr></thead>
                      <tbody>
                        {recent.map((a) => (
                          <tr key={a.id} className={a.severity === 'High' ? 'row-anomalous' : a.severity === 'Medium' ? 'row-medium' : ''} onClick={() => navigate('/anomalies')}>
                            <td className="text-muted" style={{ fontSize: 12 }}>{formatTime(a.timestamp)}</td>
                            <td><span className="font-mono" style={{ color: '#1D4ED8', fontWeight: 700 }}>{a.station_id}</span> <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: 12 }}>{String(a.parameter || '').replace('_', ' ')}</span></td>
                            <td className="num" style={{ fontWeight: 700 }}>{a.anomaly_value ?? '—'}</td>
                            <td className="num text-muted">{a.expected_range ?? '—'}</td>
                            <td className="num">{a.anomaly_score ?? '—'}</td>
                            <td><SeverityBadge severity={a.severity} /></td>
                            <td><span className="badge badge-high">Anomaly</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* STATION SNAPSHOT */}
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <div className="card-title"><Radio size={15} color="#2563EB" /> Station Status</div>
                  <div className="card-subtitle">{stations.length} stations · click a row to inspect history</div>
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/weather')}>All stations <ArrowRight size={14} /></button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Station</th><th>Location</th><th>Temp</th><th>Humidity</th><th>Pressure</th><th>Status</th><th>Updated</th></tr></thead>
                  <tbody>
                    {stations.slice(0, 8).map((s) => (
                      <tr key={s.station_id} className={s.anomaly_status ? 'row-anomalous' : ''} onClick={() => navigate(`/stations/${s.station_id}`)}>
                        <td className="font-mono" style={{ fontWeight: 700, color: '#1D4ED8' }}>{s.station_id}</td>
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

            {modelPerf?.has_ground_truth && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Model Performance</div>
                    <div className="card-subtitle">Evaluation on synthetic labelled test data — not production accuracy</div>
                  </div>
                </div>
                <div className="grid-4">
                  {[['Precision', modelPerf.metrics?.precision], ['Recall', modelPerf.metrics?.recall], ['F1 Score', modelPerf.metrics?.f1], ['Accuracy', modelPerf.metrics?.accuracy]].map(([label, value]) => (
                    <div key={label} className="health-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                      <b style={{ fontSize: 22 }}>{value ?? '—'}</b>
                    </div>
                  ))}
                </div>
                <div className="note-box mt-4">
                  TN {modelPerf.confusion_matrix?.tn} / FP {modelPerf.confusion_matrix?.fp} / FN {modelPerf.confusion_matrix?.fn} / TP {modelPerf.confusion_matrix?.tp} · prioritise F1 on imbalanced data.
                  {pipeline?.pipeline ? ` Pipeline: ${pipeline.pipeline.slice(0, 5).map((s) => s.title).join(' → ')}.` : ''}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
