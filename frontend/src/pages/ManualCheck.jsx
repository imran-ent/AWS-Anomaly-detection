import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  Thermometer,
  Droplets,
  Gauge,
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  Activity,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { getManualStations, manualSensorCheck } from '../services/api';

export default function ManualCheck() {
  const [stations, setStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState(null);

  const [stationId, setStationId] = useState('');
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [pressure, setPressure] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getManualStations()
      .then((data) => {
        // data is {total, stations: [{station_id, city}]}
        if (data && data.stations) setStations(data.stations);
        else if (Array.isArray(data)) setStations(data);
      })
      .catch((e) => setStationsError(e.message))
      .finally(() => setStationsLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!stationId) {
      setError('Please select a Station ID.');
      return;
    }
    const t = parseFloat(temperature);
    const h = parseFloat(humidity);
    const p = parseFloat(pressure);
    if ([t, h, p].some((v) => Number.isNaN(v))) {
      setError('Temperature, Humidity and Pressure must be valid numbers.');
      return;
    }
    setLoading(true);
    try {
      const data = await manualSensorCheck({
        station_id: stationId,
        temperature: t,
        humidity: h,
        pressure: p,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isAnomaly = result?.prediction?.is_anomaly;
  const status = result?.prediction?.status;

  return (
    <>
      <TopBar
        title="Manual Sensor Check"
        subtitle="On-demand ML anomaly check for a single sensor reading — uses live station history for temporal features"
      />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Manual Sensor Anomaly Check</h1>
              <p>
                Enter a live sensor reading for a known station. The backend prepends recent history for that station,
                runs the <strong>same</strong> preprocessing + feature engineering + IsolationForest model, and returns
                a truthful prediction. No mock data, no retraining.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              <Activity size={14} color="var(--accent-cyan)" />
              {stations.length ? `${stations.length} stations loaded` : stationsLoading ? 'Loading stations…' : 'Stations unavailable'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '420px 1fr',
            gap: 20,
            alignItems: 'start',
          }}
          className="manual-grid"
        >
          {/* Form Card */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="card-header">
              <div className="card-title">
                <FlaskConical size={16} color="var(--accent-cyan)" />
                Sensor Input
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Units must match dataset: °C, %, hPa
              </span>
            </div>

            {stationsError && (
              <div
                style={{
                  background: 'var(--status-high-dim)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: 'var(--status-high)',
                  marginBottom: 16,
                }}
              >
                Failed to load stations: {stationsError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Station ID */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Search size={12} />
                  Station ID
                </label>
                <select
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                  disabled={stationsLoading}
                >
                  <option value="">{stationsLoading ? 'Loading stations…' : 'Select Station ▼'}</option>
                  {stations.map((s) => (
                    <option key={s.station_id} value={s.station_id}>
                      {s.station_id} — {s.city}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Only Station_ID values that exist in the dataset are allowed. Backend validates again.
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Thermometer size={12} color="var(--accent-cyan)" />
                  Temperature
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="e.g. 25.5"
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      borderRadius: 8,
                      padding: '10px 44px 10px 12px',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    °C
                  </span>
                </div>
              </div>

              {/* Humidity */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Droplets size={12} color="#60a5fa" />
                  Humidity
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    placeholder="e.g. 70.0"
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      borderRadius: 8,
                      padding: '10px 44px 10px 12px',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              {/* Pressure */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Gauge size={12} color="#fb923c" />
                  Pressure
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    value={pressure}
                    onChange={(e) => setPressure(e.target.value)}
                    placeholder="e.g. 1012.4"
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      borderRadius: 8,
                      padding: '10px 48px 10px 12px',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    hPa
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Unusual values are <em>not</em> rejected — they may be anomalies.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  background: loading
                    ? 'var(--bg-elevated)'
                    : 'linear-gradient(90deg, var(--accent-cyan), var(--accent-teal))',
                  color: loading ? 'var(--text-muted)' : '#00111f',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Analyze Sensor
                  </>
                )}
              </button>

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> Your reading is appended
                to the last 300 historical rows for that station (same window as Dashboard), then
                <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>preprocess_data()</code>{' '}
                + <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>create_features()</code>{' '}
                generate rolling/lag features, and the trained IsolationForest predicts.
              </div>
            </form>
          </motion.div>

          {/* Result Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  borderColor: 'rgba(239,68,68,0.35)',
                  background: 'var(--status-high-dim)',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="var(--status-high)" style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--status-high)' }}>Request failed</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{error}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {!result && !error && !loading && (
              <div
                className="card"
                style={{
                  borderStyle: 'dashed',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  textAlign: 'center',
                  gap: 12,
                }}
              >
                <FlaskConical size={28} color="var(--text-muted)" />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  No analysis yet
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 320 }}>
                  Select a station and enter sensor values, then click <strong>Analyze Sensor</strong>. Results will
                  appear here.
                </div>
              </div>
            )}

            {result && (
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32 }}
                style={{
                  borderColor: isAnomaly ? 'rgba(239,68,68,0.35)' : 'rgba(0,200,150,0.35)',
                  background: isAnomaly ? 'rgba(239,68,68,0.06)' : 'rgba(0,200,150,0.06)',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Status Header */}
                <div
                  style={{
                    background: isAnomaly
                      ? 'linear-gradient(90deg, rgba(239,68,68,0.18), transparent)'
                      : 'linear-gradient(90deg, rgba(0,200,150,0.18), transparent)',
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: isAnomaly ? 'var(--status-high-dim)' : 'var(--status-normal-dim)',
                      border: `1px solid ${isAnomaly ? 'rgba(239,68,68,0.3)' : 'rgba(0,200,150,0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isAnomaly ? (
                      <AlertTriangle size={22} color="var(--status-high)" />
                    ) : (
                      <CheckCircle size={22} color="var(--status-normal)" />
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: isAnomaly ? 'var(--status-high)' : 'var(--status-normal)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Sensor Status: {status}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Station <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>{result.station_id}</span>
                      {result.city ? ` — ${result.city}` : ''} · ML Result:{' '}
                      <span style={{ fontWeight: 700 }}>
                        {isAnomaly ? 'Abnormal sensor/weather pattern detected' : 'Normal pattern detected'}
                      </span>
                    </div>
                    {!isAnomaly && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        An unusual pattern was <em>not</em> detected based on available sensor features.
                      </div>
                    )}
                    {isAnomaly && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        An unusual pattern was detected based on the combined sensor features and recent history.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Input echo */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Input Values
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                      {[
                        { label: 'Temperature', value: result.input.temperature, unit: '°C', icon: Thermometer, color: 'var(--accent-cyan)' },
                        { label: 'Humidity', value: result.input.humidity, unit: '%', icon: Droplets, color: '#60a5fa' },
                        { label: 'Pressure', value: result.input.pressure, unit: 'hPa', icon: Gauge, color: '#fb923c' },
                      ].map((r) => {
                        const Icon = r.icon;
                        return (
                          <div key={r.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                            <Icon size={16} color={r.color} style={{ marginBottom: 6 }} />
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
                              {r.value}
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}> {r.unit}</span>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }}>{r.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ML Details */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Anomaly Score</div>
                      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: isAnomaly ? 'var(--status-high)' : 'var(--status-normal)' }}>
                        {result.prediction.anomaly_score != null ? result.prediction.anomaly_score : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        IsolationForest (per-batch normalized 0–1, higher = more anomalous)
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Severity / Confidence</div>
                      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6, color: 'var(--text-primary)' }}>
                        <span
                          className={
                            result.prediction.severity === 'critical' || result.prediction.severity === 'high'
                              ? 'badge badge-high'
                              : result.prediction.severity === 'medium'
                              ? 'badge badge-medium'
                              : result.prediction.severity === 'low'
                              ? 'badge badge-low'
                              : 'badge badge-normal'
                          }
                          style={{ textTransform: 'capitalize' }}
                        >
                          {result.prediction.severity}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          conf {result.prediction.confidence ?? '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        Type: {result.prediction.predicted_fault_type}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={12} />
                      Model Explanation
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                      {result.prediction.explanation || '—'}
                    </div>
                    {isAnomaly && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                        If multivariate, no single parameter is claimed faulty — pattern is combination/temporal.
                      </div>
                    )}
                  </div>

                  {/* Suggested correction */}
                  {result.prediction.suggested_correction && (
                    <div style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                        Suggested Correction (rolling mean)
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <span>Temp {result.prediction.suggested_correction.temperature ?? '—'}°C</span>
                        <span>Hum {result.prediction.suggested_correction.humidity ?? '—'}%</span>
                        <span>Press {result.prediction.suggested_correction.pressure ?? '—'} hPa</span>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                    Dataset: {result.meta?.dataset_type} · Historical context: {result.meta?.historical_context_rows} rows · Model: {result.meta?.model} · {result.meta?.note}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* System Explanation Section - for SIH judge presentation */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.32 }}
          style={{ marginTop: 20 }}
        >
          <div className="card-header">
            <div className="card-title">
              <Activity size={16} color="var(--accent-cyan)" />
              How METEORA Detects Anomalies
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>End-to-end ML pipeline — single source of truth</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { step: 1, title: 'Weather data collected', desc: '29 AWS stations, hourly Temp/Humidity/Pressure (+ synthetic Rainfall/Wind). Injected anomaly dataset (5% Spike/Drift/Frozen/Comm Error) is the demo source.' },
              { step: 2, title: 'Cleaned & preprocessed', desc: 'preprocess_data(): column normalization, timestamp parsing, missing/physical-range flags, z-score scaling. Same function for all routes.' },
              { step: 3, title: 'Features generated', desc: 'create_features(): hour/day, rates, rolling mean/std (window 5), deviation, abs_change, temp/humidity ratio. + frozen_run_length & consistency flags.' },
              { step: 4, title: 'Compared to history', desc: 'IsolationForest trained on normal behavior (contamination 0.02). Decision_function per-batch normalized; deterministic overrides for frozen/missing.' },
              { step: 5, title: 'IsolationForest predicts', desc: 'predict == -1 => anomaly. anomaly_score 0-1 (higher = more anomalous). Confidence & sensor_health_status (rolling 50).' },
              { step: 6, title: 'Severity from score', desc: 'Forced (frozen/missing) => HIGH/CRITICAL. Statistical => High ≥0.88, Medium ≥0.80, Low else. Ensures High/Medium/Low visible.' },
              { step: 7, title: 'Explains the reason', desc: 'Ranks engineered features by |value|, maps to readable reason. Expected range = rolling mean ±2σ per station. Multivariate flagged when no single param is out-of-range.' },
            ].map((s) => (
              <div key={s.step} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: '0.06em' }}>STEP {s.step}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
            Data flow: RAW CSV (weather_data1.csv) → preprocess_data() → create_features() → detect_anomalies(IsolationForest) → centralized cache (_get_df) → API (/api/dashboard, /api/stations, /api/anomalies) → Frontend. Any change to this pipeline invalidates cache (5 min TTL).
          </div>
        </motion.div>

        <style>{`@media (max-width: 900px) { .manual-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </>
  );
}
