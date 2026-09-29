import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowRight, CheckCircle2, Loader2, Info } from 'lucide-react';
import TopBar from '../components/TopBar';
import UploadDropzone from '../components/UploadDropzone';
import { SeverityBadge } from '../components/Badges';
import { getManualStations, manualSensorCheck } from '../services/api';

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function Analyze() {
  const [meta, setMeta] = useState(null);
  const [stations, setStations] = useState([]);
  const [fallbackStation, setFallbackStation] = useState('');
  const [busy, setBusy] = useState(null);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    getManualStations()
      .then((d) => {
        const list = d?.stations || (Array.isArray(d) ? d : []);
        setStations(list);
        if (list[0]) setFallbackStation(list[0].station_id);
      })
      .catch(() => {});
  }, []);

  const knownIds = new Set(stations.map((s) => s.station_id));
  const preview = meta ? meta.rows.slice(0, 8) : [];
  const { cols } = meta?.report || {};

  const analyzeRow = async (idx) => {
    const row = meta.rows[idx];
    const stationId = (cols?.station && String(row[cols.station]).trim()) || '';
    const sid = knownIds.has(stationId) ? stationId : fallbackStation;
    const temperature = num(cols?.temperature ? row[cols.temperature] : null);
    const humidity = num(cols?.humidity ? row[cols.humidity] : null);
    const pressure = num(cols?.pressure ? row[cols.pressure] : null);
    if (!sid || temperature == null || humidity == null || pressure == null) {
      setErrors((p) => ({ ...p, [idx]: 'Row needs a known station and numeric temperature, humidity and pressure to run the model.' }));
      return;
    }
    setBusy(idx);
    setErrors((p) => ({ ...p, [idx]: null }));
    try {
      const res = await manualSensorCheck({ station_id: sid, temperature, humidity, pressure });
      setResults((p) => ({ ...p, [idx]: { ...res, used_station: sid } }));
    } catch (e) {
      setErrors((p) => ({ ...p, [idx]: e.message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <TopBar title="Analyze Weather Data" subtitle="Validate a CSV locally, then run readings through the live ML model" />
      <div className="page-wrapper">
        <div className="page-header">
          <h1>Upload weather station data</h1>
          <p>Upload weather station data and let WeatherGuard AI identify unusual patterns, sensor deviations, and potential anomalies. Files are parsed in your browser; only readings you choose are sent to the detection model.</p>
        </div>

        <div className="card mb-4">
          <UploadDropzone onValidated={setMeta} />
        </div>

        {meta && (
          <div className="card mb-4">
            <div className="card-header">
              <div>
                <div className="card-title"><FlaskConical size={15} color="#7DD3FC" /> Row-level analysis</div>
                <div className="card-subtitle">
                  Showing first {preview.length} of {meta.report.rowCount.toLocaleString()} rows · each analysis calls the live Isolation Forest model
                </div>
              </div>
              {!cols?.station && (
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  Station for rows
                  <select className="form-select" value={fallbackStation} onChange={(e) => setFallbackStation(e.target.value)}>
                    {stations.map((s) => (<option key={s.station_id} value={s.station_id}>{s.station_id} — {s.city}</option>))}
                  </select>
                </label>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>Station</th><th>Temp (°C)</th><th>Humidity (%)</th><th>Pressure (hPa)</th><th>Result</th><th></th></tr></thead>
                <tbody>
                  {preview.map((row, i) => {
                    const r = results[i];
                    return (
                      <tr key={i}>
                        <td className="text-muted">{i + 1}</td>
                        <td className="font-mono" style={{ color: '#7DD3FC', fontWeight: 700 }}>
                          {(cols?.station && String(row[cols.station] || '—')) || fallbackStation || '—'}
                        </td>
                        <td className="num">{cols?.temperature ? String(row[cols.temperature] ?? '—') : '—'}</td>
                        <td className="num">{cols?.humidity ? String(row[cols.humidity] ?? '—') : '—'}</td>
                        <td className="num">{cols?.pressure ? String(row[cols.pressure] ?? '—') : '—'}</td>
                        <td>
                          {busy === i && <span className="flex-row" style={{ fontSize: 12, color: 'var(--text-muted)' }}><Loader2 size={13} className="spin" /> Analyzing…</span>}
                          {r && (
                            <span className="flex-row">
                              <SeverityBadge severity={r.prediction?.severity === 'none' ? 'Normal' : r.prediction?.severity} />
                              <span className="num text-muted" style={{ fontSize: 11 }}>score {r.prediction?.anomaly_score ?? '—'}</span>
                            </span>
                          )}
                          {errors[i] && <span style={{ fontSize: 11.5, color: '#FCA5A5' }}>{errors[i]}</span>}
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy === i} onClick={() => analyzeRow(i)}>
                            {r ? 'Re-run' : 'Analyze'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="note-box mt-4 flex-row">
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>Need full control over a single reading? <button className="btn btn-ghost" style={{ padding: 0, fontSize: 12 }} onClick={() => navigate('/manual-check')}>Open Manual Sensor Check <ArrowRight size={13} /></button></span>
            </div>
          </div>
        )}

        {!meta && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">How analysis works</div>
            </div>
            <div className="pipeline-check"><span className="check-icon todo"><CheckCircle2 size={13} /></span><span><strong>File validated</strong> — columns detected and plausibility checked locally</span></div>
            <div className="pipeline-check"><span className="check-icon todo"><CheckCircle2 size={13} /></span><span><strong>Reading analysed</strong> — the backend runs preprocessing, features and Isolation Forest</span></div>
            <div className="pipeline-check"><span className="check-icon todo"><CheckCircle2 size={13} /></span><span><strong>Result explained</strong> — status, anomaly score, severity and reason returned</span></div>
          </div>
        )}
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
