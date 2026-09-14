import { useEffect, useState } from 'react';
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
  const color =
    value > 45
      ? 'var(--status-high)'
      : value < 5
      ? 'var(--status-info)'
      : value > 38
      ? 'var(--status-medium)'
      : 'var(--text-primary)';
  return (
    <span style={{ color, fontWeight: value > 45 || value < 5 ? 700 : 400 }} title="Value-level coloring (not ML status)">
      {value}°C
    </span>
  );
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
  const navigate = useNavigate();

  useEffect(() => {
    getStations()
      .then(setStations)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === 'anomalous'
      ? stations.filter((s) => s.anomaly_status)
      : filter === 'normal'
      ? stations.filter((s) => !s.anomaly_status)
      : stations;

  const anomalousCount = stations.filter((s) => s.anomaly_status).length;

  return (
    <>
      <TopBar
        title="Live Weather Data"
        subtitle={`${stations.length} stations · ${anomalousCount} with active anomalies`}
      />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Station Readings</h1>
              <p>
                Current sensor readings from all AWS stations. Click a row to view
                station details &amp; 24-hour history.
              </p>
            </div>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'anomalous', 'normal'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 99,
                    border: `1px solid ${
                      filter === f ? 'var(--accent-cyan)' : 'var(--border-subtle)'
                    }`,
                    background:
                      filter === f ? 'var(--accent-cyan-dim)' : 'transparent',
                    color:
                      filter === f ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  {f === 'all' ? `All (${stations.length})` : f === 'anomalous' ? `⚠ Anomalous (${anomalousCount})` : `✓ Normal (${stations.length - anomalousCount})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading station data…</span>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <MapPin size={11} />
                        Station
                      </div>
                    </th>
                    <th>Location</th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <Thermometer size={11} />
                        Temp
                      </div>
                    </th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <Droplets size={11} />
                        Humidity
                      </div>
                    </th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <CloudRain size={11} />
                        Rainfall
                      </div>
                    </th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <Wind size={11} />
                        Wind
                      </div>
                    </th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <Gauge size={11} />
                        Pressure
                      </div>
                    </th>
                    <th>Status</th>
                    <th>
                      <div className="flex-row" style={{ gap: 5 }}>
                        <Clock size={11} />
                        Last Updated
                      </div>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((station, i) => {
                    const rowClass = station.anomaly_status ? 'row-anomalous' : '';
                    return (
                      <motion.tr
                        key={station.station_id}
                        className={rowClass}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        custom={i}
                        onClick={() => navigate(`/stations/${station.station_id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className="font-mono text-cyan" style={{ fontSize: 13, fontWeight: 700 }}>
                            {station.station_id}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{station.location}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {station.state}
                          </div>
                        </td>
                        <td>
                          <TempCell value={station.temperature} />
                        </td>
                        <td>
                          {station.humidity == null ? (
                            <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                          ) : (
                            <span
                              style={{
                                color:
                                  station.humidity < 20
                                    ? 'var(--status-high)'
                                    : station.humidity > 90
                                    ? 'var(--status-medium)'
                                    : 'var(--text-primary)',
                                fontWeight:
                                  station.humidity < 20 || station.humidity > 90 ? 700 : 400,
                              }}
                              title="Humidity value-level coloring (high humidity ≠ ML anomaly; see Status badge for ML verdict)"
                            >
                              {station.humidity}%
                            </span>
                          )}
                        </td>
                        <td>
                          <RainfallCell value={station.rainfall} />
                        </td>
                        <td>
                          <WindCell value={station.wind_speed} />
                        </td>
                        <td>
                          <PressureCell value={station.pressure} />
                        </td>
                        <td>
                          <StatusBadge anomalyStatus={station.anomaly_status} />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {formatTime(station.timestamp)}
                        </td>
                        <td>
                          <ChevronRight size={14} color="var(--text-muted)" />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          <span>
            <span style={{ color: 'var(--status-high)' }}>■</span> Red border/highlight
            = ML model flagged <strong>ANOMALY</strong> (multivariate pattern)
          </span>
          <span>
            <span style={{ color: 'var(--status-high)' }}>■</span> Red value =
            value-level high/low (not ML verdict)
          </span>
          <span>
            <span style={{ color: 'var(--status-medium)' }}>■</span> Orange value =
            approaching value-level threshold (not ML verdict)
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Humidity 93% orange ≠ HIGH anomaly — Status badge shows ML verdict. Value coloring is univariate threshold, anomaly is multivariate ML.
          </span>
          <span>
            <span style={{ color: 'var(--status-medium)' }}>■</span> Pressure shown from dataset (990-1025 hPa typical)
          </span>
        </div>
      </div>
    </>
  );
}
