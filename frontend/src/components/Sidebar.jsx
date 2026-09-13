import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CloudRain,
  AlertTriangle,
  Radio,
  Bell,
  Zap,
  Activity,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/weather', label: 'Live Weather Data', icon: CloudRain },
  { to: '/anomalies', label: 'Anomaly Monitoring', icon: AlertTriangle, badge: 8 },
  { to: '/alerts', label: 'Alerts', icon: Bell, badge: 3 },
];

export default function Sidebar() {
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
              {item.badge && (
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
        >
          <Radio size={16} strokeWidth={2} />
          15 Stations Online
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

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="demo-badge">
          <span className="demo-dot" />
          DEMO MODE · MOCK DATA
        </div>
      </div>
    </aside>
  );
}
