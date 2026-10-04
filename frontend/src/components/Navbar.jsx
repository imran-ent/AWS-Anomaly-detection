import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, TriangleAlert, Bell, FlaskConical, Info, Menu, X, ShieldCheck, UploadCloud } from 'lucide-react';
import { getDashboardSummary } from '../services/api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/weather', label: 'Monitoring', icon: Radio },
  { to: '/anomalies', label: 'Analytics', icon: TriangleAlert },
  { to: '/analyze', label: 'Analyze', icon: UploadCloud },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/manual-check', label: 'Sensor Check', icon: FlaskConical },
  { to: '/about', label: 'About', icon: Info },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [anomalyBadge, setAnomalyBadge] = useState(null);
  const [healthy, setHealthy] = useState(true);
  const location = useLocation();

  // Close mobile menu on route change or Escape
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await getDashboardSummary();
        if (cancelled) return;
        const total = s.anomaliesDetected ?? s.totalAnomalies ?? null;
        if (typeof total === 'number') setAnomalyBadge(total > 99 ? '99+' : total);
        setHealthy(!s._isMock);
      } catch {
        if (!cancelled) setHealthy(false);
      }
    }
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <>
      <nav className="topnav" aria-label="Primary">
        <div className="topnav-inner">
          <NavLink to="/" className="brand" aria-label="WeatherGuard AI home">
            <span className="brand-mark" aria-hidden="true">
              <ShieldCheck size={17} color="#fff" strokeWidth={2.2} />
            </span>
            <span>
              <span className="brand-name">WeatherGuard <span>AI</span></span>
              <br />
              <span className="brand-tag">Weather Monitoring &amp; Anomaly Detection</span>
            </span>
          </NavLink>

          <div className="topnav-links">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
                >
                  <Icon size={15} strokeWidth={2} />
                  {item.label}
                  {item.to === '/anomalies' && anomalyBadge !== null && (
                    <span className="topnav-badge">{anomalyBadge}</span>
                  )}
                </NavLink>
              );
            })}
          </div>

          <div className="topnav-right">
            <span className={`system-status-pill${healthy ? '' : ' warn'}`} title={healthy ? 'Backend reachable' : 'Backend offline — demo data'}>
              <span className="status-dot-live" />
              {healthy ? 'System Operational' : 'Demo Mode'}
            </span>
            <button className="hamburger" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>
      <div className={`mobile-menu${open ? ' open' : ''}`}>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={15} strokeWidth={2} />
              {item.label}
              {item.to === '/anomalies' && anomalyBadge !== null && (
                <span className="topnav-badge">{anomalyBadge}</span>
              )}
            </NavLink>
          );
        })}
      </div>
    </>
  );
}
