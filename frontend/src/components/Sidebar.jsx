import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CloudRain,
  AlertTriangle,
  Radio,
  Bell,
  Zap,
  Activity,
  FlaskConical,
} from 'lucide-react';
import { getDashboardSummary, getAnomalies } from '../services/api';

const baseNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/weather', label: 'Weather Data (Historical)', icon: CloudRain },
  { to: '/anomalies', label: 'Anomaly Monitoring', icon: AlertTriangle },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/manual-check', label: 'Manual Sensor Check', icon: FlaskConical },
];

export default function Sidebar() {
  const [totalStations, setTotalStations] = useState(null);
  const [anomalyBadge, setAnomalyBadge] = useState(null);
  const [alertBadge, setAlertBadge] = useState(null);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const summary = await getDashboardSummary();
        if (cancelled) return;
        // summary.totalStations = unique stations from actual dataset (29)
        if (summary && typeof summary.totalStations === 'number') {
          setTotalStations(summary.totalStations);
        }
        if (summary && summary._isMock) setIsMock(true);
        // anomalies badge = total detected anomalies in current window (from dashboard)
        // Use anomaliesDetected / totalAnomalies for badge (truthful total, not hardcoded 8)
        const totalAnom = summary.anomaliesDetected ?? summary.totalAnomalies ?? summary.anomaliesToday;
        if (typeof totalAnom === 'number') setAnomalyBadge(totalAnom > 99 ? '99+' : totalAnom);
        const activeAlerts = summary.activeAlerts;
        if (typeof activeAlerts === 'number') setAlertBadge(activeAlerts > 99 ? '99+' : activeAlerts);
      } catch {
        // backend unavailable — leave badges hidden, will show mock label
        setIsMock(true);
      }
      // Also try anomalies endpoint for more recent count if dashboard failed
      try {
        // fetch limited anomalies to double-check badge not stale; but dashboard is source of truth
      } catch {}
    }
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const navItems = baseNav.map((item) => {
    if (item.label === 'Anomaly Monitoring' && anomalyBadge !== null) return { ...item, badge: anomalyBadge };
    if (item.label === 'Alerts' && alertBadge !== null) return { ...item, badge: alertBadge };
    return item;
  });

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="logo-icon">
            <Activity size={20} color="#050d1a" strokeWidth={2.5} />
          </div>
          <div>
            <div className="logo-text">AnomalyWatch</div>
            <div className="logo-sub">AWS Monitoring</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
              {item.badge !== undefined && item.badge !== null && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </NavLink>
          );
        })}

        <div className="nav-section-label" style={{ marginTop: 8 }}>
          System
        </div>

        <div
          className="nav-link"
          style={{ cursor: 'default' }}
          title={totalStations ? `Unique stations from active dataset (${totalStations})` : 'Loading stations...'}
        >
          <Radio size={16} strokeWidth={2} />
          {totalStations !== null ? `${totalStations} Stations Online` : 'Loading stations…'}
          <span
            style={{
              marginLeft: 'auto',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--status-normal)',
              animation: 'pulse-dot 1.8s ease-in-out infinite',
              display: 'block',
            }}
          />
        </div>

        <div className="nav-link" style={{ cursor: 'default' }}>
          <Zap size={16} strokeWidth={2} />
          ML Model Active
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--status-normal)',
              fontWeight: 700,
            }}
          >
            v2.1
          </span>
        </div>
      </nav>

      {/* Footer — truthful demo label */}
      <div className="sidebar-footer">
        {isMock ? (
           <div className="demo-badge" title="Backend unavailable — showing demo data (historical window)">
             <span className="demo-dot" style={{ background: '#f97316' }} />
             DEMO DATA · BACKEND OFFLINE
           </div>
         ) : (
           <div className="demo-badge" style={{ opacity: 0.85 }} title="Historical window (last 300/station) — simulated near-real-time prototype">
             <span className="demo-dot" style={{ background: '#10b981' }} />
             SIMULATED LIVE · HISTORICAL
           </div>
         )}
      </div>
    </aside>
  );
}
