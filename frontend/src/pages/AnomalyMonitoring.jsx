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
} from 'recharts';
import {
  TrendingUp,
  Filter,
  Clock,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, formatTime } from '../components/Badges';
import { getAnomalies, getAnomalyTrend } from '../services/api';

const PARAMETER_LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  rainfall: 'Rainfall',
  wind_speed: 'Wind Speed',
  pressure: 'Pressure',
};

const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 };

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

export default function AnomalyMonitoring() {
  const [anomalies, setAnomalies] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getAnomalies(), getAnomalyTrend()])
      .then(([a, t]) => {
        const sorted = [...a].sort(
          (x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]
        );
        setAnomalies(sorted);
        setTrend(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const filters = ['All', 'High', 'Medium', 'Low'];
  const filtered =
    severityFilter === 'All'
      ? anomalies
      : anomalies.filter((a) => a.severity === severityFilter);

  const highCount = anomalies.filter((a) => a.severity === 'High').length;
  const medCount = anomalies.filter((a) => a.severity === 'Medium').length;
  const lowCount = anomalies.filter((a) => a.severity === 'Low').length;

  const rowClass = (sev) =>
    sev === 'High' ? 'row-anomalous' : sev === 'Medium' ? 'row-medium' : '';

  return (
    <>
      <TopBar
        title="Anomaly Monitoring"
        subtitle={`${anomalies.length} anomalies detected · ${highCount} critical`}
      />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Anomaly Records</h1>
              <p>
                All anomalies detected by the ML model across all stations. Sorted by
                severity. Click a row to inspect the station.
              </p>
            </div>
            {/* Severity summary pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-high">{highCount} High</span>
              <span className="badge badge-medium">{medCount} Medium</span>
              <span className="badge badge-low">{lowCount} Low</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading anomaly data…</span>
          </div>
        ) : (
          <>
            {/* Trend Chart */}
            <motion.div
              className="card mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">
                    <TrendingUp size={16} color="var(--accent-cyan)" />
                    7-Day Severity Breakdown
                  </div>
                  <div className="card-subtitle">
                    Anomaly counts per severity tier over the past week
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#facc15" stopOpacity={0.25} />
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
                      wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 10 }}
                    />
                    <Area type="monotone" dataKey="high" name="High" stroke="#ef4444" strokeWidth={2.5} fill="url(#gHigh)" />
                    <Area type="monotone" dataKey="medium" name="Medium" stroke="#f97316" strokeWidth={2} fill="url(#gMed)" />
                    <Area type="monotone" dataKey="low" name="Low" stroke="#facc15" strokeWidth={1.5} fill="url(#gLow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
              <Filter size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>
                Filter:
              </span>
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 99,
                    border: `1px solid ${
                      severityFilter === f ? 'var(--accent-cyan)' : 'var(--border-subtle)'
                    }`,
                    background:
                      severityFilter === f ? 'var(--accent-cyan-dim)' : 'transparent',
                    color:
                      severityFilter === f ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  {f}
                </button>
              ))}
              <span
                style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}
              >
                Showing {filtered.length} records
              </span>
            </div>

            {/* Table */}
            <motion.div
              className="card"
              style={{ padding: 0 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Station ID</th>
                      <th>Parameter</th>
                      <th>Anomaly Value</th>
                      <th>Expected Range</th>
                      <th>Severity</th>
                      <th>
                        <div className="flex-row" style={{ gap: 5 }}>
                          <Clock size={11} />
                          Timestamp
                        </div>
                      </th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((anomaly, i) => (
                      <motion.tr
                        key={anomaly.id}
                        className={rowClass(anomaly.severity)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        onClick={() => navigate(`/stations/${anomaly.station_id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {i + 1}
                        </td>
                        <td>
                          <span className="font-mono text-cyan" style={{ fontSize: 13, fontWeight: 700 }}>
                            {anomaly.station_id}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {PARAMETER_LABELS[anomaly.parameter] || anomaly.parameter}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color:
                                anomaly.severity === 'High'
                                  ? 'var(--status-high)'
                                  : anomaly.severity === 'Medium'
                                  ? 'var(--status-medium)'
                                  : 'var(--status-low)',
                            }}
                          >
                            {anomaly.anomaly_value}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {anomaly.expected_range}
                          </span>
                        </td>
                        <td>
                          <SeverityBadge severity={anomaly.severity} />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {formatTime(anomaly.timestamp)}
                        </td>
                        <td
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            maxWidth: 220,
                          }}
                        >
                          {anomaly.description}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </>
  );
}
