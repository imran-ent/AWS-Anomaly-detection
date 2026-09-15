import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Clock,
  MapPin,
  ChevronRight,
  Gauge,
  Search,
  Filter,
  ChevronLeft,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { StatusBadge, formatTime } from '../components/Badges';
import { getStations } from '../services/api';

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.28 },
  }),
};

function TempCell({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
  const color = value > 45 ? 'var(--status-high)' : value < 5 ? 'var(--status-info)' : value > 38 ? 'var(--status-medium)' : 'var(--text-primary)';
  return (<span style={{ color, fontWeight: value > 45 || value < 5 ? 700 : 400 }} title="Value-level coloring (not ML status)">{value}°C</span>);
}
function WindCell({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
  const color = value > 50 ? 'var(--status-high)' : value > 35 ? 'var(--status-medium)' : 'var(--text-primary)';
  return <span style={{ color, fontWeight: value > 50 ? 700 : 400 }} title="Value-level coloring (not ML status)">{value} km/h</span>;
}
function RainfallCell({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
  const color = value > 100 ? 'var(--status-high)' : value > 50 ? 'var(--status-medium)' : 'var(--text-primary)';
  return <span style={{ color, fontWeight: value > 100 ? 700 : 400 }}>{value} mm</span>;
}
function PressureCell({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
  const color = value < 990 || value > 1030 ? 'var(--status-high)' : value < 995 || value > 1025 ? 'var(--status-medium)' : 'var(--text-primary)';
  return <span style={{ color, fontWeight: value < 990 || value > 1030 ? 700 : 400 }}>{value} hPa</span>;
}

export default function WeatherData() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [visibleParams, setVisibleParams] = useState({ temperature: true, humidity: true, rainfall: true, wind_speed: true, pressure: true });
  const [page, setPage] = useState(1);
  const perPage = 15;
  const navigate = useNavigate();

  useEffect(() => {
    getStations().then(setStations).finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => {
    const s = new Set(stations.map((x) => x.city || x.location));
    return ['All', ...Array.from(s).sort()];
  }, [stations]);

  const filtered = useMemo(() => {
    let out = [...stations];
    if (filter === 'anomalous') out = out.filter((s) => s.anomaly_status);
    else if (filter === 'normal') out = out.filter((s) => !s.anomaly_status);
    if (cityFilter !== 'All') out = out.filter((s) => (s.city || s.location) === cityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((s) => `${s.station_id} ${s.location} ${s.city} ${s.state}`.toLowerCase().includes(q));
    }
    return out;
  }, [stations, filter, cityFilter, search]);

  useEffect(() => setPage(1), [filter, cityFilter, search]);

  const anomalousCount = stations.filter((s) => s.anomaly_status).length;
  const pageCount = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <TopBar title="Historical Weather Data" subtitle={`${stations.length} stations · ${anomalousCount} with active anomalies · Simulated window (last 300/station) · Historical prototype`} />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Station Readings</h1>
              <p>Current sensor readings from all AWS stations (latest in window). Parameters shown are those present in dataset (temperature, humidity, pressure) + synthesized rainfall/wind for completeness. Click a row for station detail & 24-hour history with expected bounds.</p>
            </div>
          </div>
        </div>

        {/* Filters — Phase 10,11,12 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
          <Filter size={14} color="var(--text-muted)" />
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
            {cities.map((c) => (<option key={c} value={c}>{c === 'All' ? 'All Stations' : c}</option>))}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','anomalous','normal'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 99, border: `1px solid ${filter===f ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: filter===f ? 'var(--accent-cyan-dim)' : 'transparent', color: filter===f ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer' }}>{f==='all'?`All (${stations.length})`:f==='anomalous'?`⚠ Anomalous (${anomalousCount})`:`✓ Normal (${stations.length - anomalousCount})`}</button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search station, city, state…" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px 7px 32px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Params:</span>
            {[
              { key: 'temperature', label: 'Temp' },
              { key: 'humidity', label: 'Hum' },
              { key: 'pressure', label: 'Press' },
              { key: 'rainfall', label: 'Rain' },
              { key: 'wind_speed', label: 'Wind' },
            ].map((p) => (
              <button key={p.key} onClick={() => setVisibleParams((prev) => ({ ...prev, [p.key]: !prev[p.key] }))} style={{ padding: '4px 10px', borderRadius: 99, border: `1px solid ${visibleParams[p.key] ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: visibleParams[p.key] ? 'var(--accent-cyan-dim)' : 'transparent', color: visibleParams[p.key] ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading station data…</span></div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th><div className="flex-row" style={{ gap: 5 }}><MapPin size={11} />Station</div></th>
                    <th>Location</th>
                    {visibleParams.temperature && <th><div className="flex-row" style={{ gap: 5 }}><Thermometer size={11} />Temp</div></th>}
                    {visibleParams.humidity && <th><div className="flex-row" style={{ gap: 5 }}><Droplets size={11} />Humidity</div></th>}
                    {visibleParams.rainfall && <th><div className="flex-row" style={{ gap: 5 }}><CloudRain size={11} />Rainfall</div></th>}
                    {visibleParams.wind_speed && <th><div className="flex-row" style={{ gap: 5 }}><Wind size={11} />Wind</div></th>}
                    {visibleParams.pressure && <th><div className="flex-row" style={{ gap: 5 }}><Gauge size={11} />Pressure</div></th>}
                    <th>Status</th>
                    <th><div className="flex-row" style={{ gap: 5 }}><Clock size={11} />Last Updated</div></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((station, i) => {
                    const rowClass = station.anomaly_status ? 'row-anomalous' : '';
                    return (
                      <motion.tr key={station.station_id} className={rowClass} variants={rowVariants} initial="hidden" animate="visible" custom={i} onClick={() => navigate(`/stations/${station.station_id}`)} style={{ cursor: 'pointer' }}>
                        <td><span className="font-mono text-cyan" style={{ fontSize: 13, fontWeight: 700 }}>{station.station_id}</span></td>
                        <td><div style={{ fontWeight: 500 }}>{station.location}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{station.state}</div></td>
                        {visibleParams.temperature && <td><TempCell value={station.temperature} /></td>}
                        {visibleParams.humidity && <td>{station.humidity == null ? (<span style={{ color: 'var(--text-muted)' }}>N/A</span>) : (<span style={{ color: station.humidity < 20 ? 'var(--status-high)' : station.humidity > 90 ? 'var(--status-medium)' : 'var(--text-primary)', fontWeight: station.humidity < 20 || station.humidity > 90 ? 700 : 400 }} title="Humidity value coloring ≠ ML verdict">{station.humidity}%</span>)}</td>}
                        {visibleParams.rainfall && <td><RainfallCell value={station.rainfall} /></td>}
                        {visibleParams.wind_speed && <td><WindCell value={station.wind_speed} /></td>}
                        {visibleParams.pressure && <td><PressureCell value={station.pressure} /></td>}
                        <td><StatusBadge anomalyStatus={station.anomaly_status} /></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTime(station.timestamp)}</td>
                        <td><ChevronRight size={14} color="var(--text-muted)" /></td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>No stations match filters.</div>}
            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p-1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: page<=1 ? 'var(--bg-elevated)' : 'var(--accent-cyan-dim)', color: page<=1 ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: page<=1?'not-allowed':'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={14} />Prev</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} of {pageCount} · {filtered.length} stations (15 per page)</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p+1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: page>=pageCount ? 'var(--bg-elevated)' : 'var(--accent-cyan-dim)', color: page>=pageCount ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: page>=pageCount?'not-allowed':'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Next<ChevronRight size={14} /></button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <span><span style={{ color: 'var(--status-high)' }}>■</span> Red border/highlight = ML flagged <strong>ANOMALY</strong> (multivariate pattern, backend truth)</span>
          <span><span style={{ color: 'var(--status-high)' }}>■</span> Red value = value-level high/low (not ML verdict)</span>
          <span><span style={{ color: 'var(--status-medium)' }}>■</span> Orange value = approaching threshold (not ML verdict)</span>
          <span>Only dataset params (temp/humidity/pressure) are ML inputs; rainfall/wind synthesized for table completeness (not used by model).</span>
          <span>Stations list is dynamic from <code>/api/stations</code> (29 cities), not hardcoded. Pagination prevents rendering 29+ rows issue.</span>
        </div>
      </div>
    </>
  );
}
