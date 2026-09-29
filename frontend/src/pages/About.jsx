import { useEffect, useState } from 'react';
import { Database, Cpu, GitBranch, TriangleAlert, ShieldCheck, Info } from 'lucide-react';
import TopBar from '../components/TopBar';
import { getModelInfo, getPipeline } from '../services/api';

export default function About() {
  const [modelInfo, setModelInfo] = useState(null);
  const [pipeline, setPipeline] = useState(null);

  useEffect(() => {
    getModelInfo().then(setModelInfo).catch(() => {});
    getPipeline().then(setPipeline).catch(() => {});
  }, []);

  return (
    <>
      <TopBar title="About" subtitle="Detection method, data pipeline and model information" />
      <div className="page-wrapper">
        <div className="page-header">
          <h1>How WeatherGuard AI works</h1>
          <p>Monitor sensor health and detect abnormal weather readings in real time. The system analyses historical sensor behaviour and flags observations that deviate significantly from expected patterns.</p>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title"><Cpu size={16} color="#1D5FBF" /> Detection method</div>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Machine-learning anomaly detection (Isolation Forest).</strong>{' '}
            The model is trained unsupervised on normal station behaviour and assigns each reading an anomaly
            score from 0 to 1. Readings flagged by the forest — or forced by deterministic rules for missing
            values, frozen sensors and physically impossible ranges — are reported with severity, expected
            range and explanation. The frontend never re-decides anomalies; the backend is the source of truth.
          </p>
          {modelInfo && (
            <div className="grid-2 mt-4">
              <div className="note-box">
                <b>Model</b><br />
                {modelInfo.model || 'Isolation Forest (200 trees, contamination 0.02)'}<br />
                <span className="text-muted">{modelInfo.primary_detector || ''} · Learning: {modelInfo.learning_type || 'unsupervised'}</span>
              </div>
              <div className="note-box">
                <b>Features ({modelInfo.feature_count || 18})</b><br />
                <span className="font-mono" style={{ fontSize: 11 }}>{(modelInfo.features || []).join(', ')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div>
              <div className="card-title"><GitBranch size={16} color="#0F766E" /> Data pipeline</div>
              <div className="card-subtitle">Raw weather data to alert and visualisation</div>
            </div>
          </div>
          {pipeline?.pipeline ? (
            <div className="pipeline-steps">
              {pipeline.pipeline.slice(0, 10).map((s) => (
                <div key={s.step} className="pipeline-step">
                  <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-blue)' }}>STEP {s.step}</span>
                  <b>{s.title}</b>
                  <span>{s.desc}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
              {[
                ['Weather Station', '29 AWS stations, hourly readings'],
                ['Sensor Data', 'Temperature, humidity, pressure'],
                ['Processing', 'Validation, scaling, features'],
                ['ML Detection', 'Isolation Forest + rules'],
                ['Alert & Visualisation', 'Severity, dashboard, alerts'],
              ].map(([t, d]) => (
                <div key={t} className="pipeline-step"><b>{t}</b><span>{d}</span></div>
              ))}
            </div>
          )}
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-title"><Database size={16} color="#1D5FBF" /> Data</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.7 }}>
              842,160 hourly records across 29 Indian stations. The evaluation window uses a labelled set with
              5% injected faults (spike, drift, frozen sensor, communication error) so precision and recall can
              be measured honestly. Rainfall and wind values shown in tables are synthesised for completeness
              and are not model inputs.
            </p>
          </div>
          <div className="card">
            <div className="card-title"><TriangleAlert size={16} color="#B45309" /> Limitations</div>
            <ul style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.8, paddingLeft: 18 }}>
              <li>Historical analysis prototype — not a live AWS stream or weather forecast.</li>
              <li>Gradual drift recall is low (~2%); multivariate sensitivity causes some false positives.</li>
              <li>Anomaly scores are relative within each batch, not probabilities.</li>
            </ul>
            <div className="note-box mt-4 flex-row"><ShieldCheck size={14} /> Scores shown as 0–1 values, never as confidence percentages.</div>
          </div>
        </div>

        <div className="note-box mt-4 flex-row"><Info size={14} /> Full technical reference is available in the project README (pipeline, endpoints, evaluation metrics).</div>
      </div>
    </>
  );
}
