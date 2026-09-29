import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="flex-row">
            <span className="brand-mark" style={{ width: 28, height: 28 }}>
              <ShieldCheck size={15} color="#fff" strokeWidth={2.2} />
            </span>
            <b>WeatherGuard AI</b>
          </div>
          <p>Intelligent Weather Monitoring &amp; Anomaly Detection. AI-powered monitoring for reliable and actionable weather station data.</p>
        </div>
        <div className="footer-meta">
          <div>Isolation Forest · 29 AWS stations · Historical analysis prototype</div>
          <div>Backend is the single source of truth · &copy; 2026 WeatherGuard AI</div>
        </div>
      </div>
    </footer>
  );
}
