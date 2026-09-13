import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Info,
  AlertOctagon,
  CheckCircle,
  Bell,
  BellOff,
  Clock,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { SeverityBadge, formatTime } from '../components/Badges';
import { getAlerts } from '../services/api';

function getAlertIcon(severity) {
  if (severity === 'High') return AlertOctagon;
  if (severity === 'Medium') return AlertTriangle;
  return Info;
}

function getAlertColors(severity, read) {
  if (severity === 'High')
    return {
      iconBg: 'var(--status-high-dim)',
      iconColor: 'var(--status-high)',
      dotColor: 'var(--status-high)',
      cardClass: read ? 'alert-card' : 'alert-card unread-high',
    };
  if (severity === 'Medium')
    return {
      iconBg: 'var(--status-medium-dim)',
      iconColor: 'var(--status-medium)',
      dotColor: 'var(--status-medium)',
      cardClass: read ? 'alert-card' : 'alert-card unread-medium',
    };
  return {
    iconBg: 'var(--status-info-dim)',
    iconColor: 'var(--status-info)',
    dotColor: 'var(--accent-cyan)',
    cardClass: read ? 'alert-card' : 'alert-card unread',
  };
}

const cardVariants = {
  hidden: { opacity: 0, x: -16, scale: 0.98 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
  exit: { opacity: 0, x: 16, transition: { duration: 0.2 } },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [readState, setReadState] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    getAlerts()
      .then((data) => {
        setAlerts(data);
        const initial = {};
        data.forEach((a) => {
          initial[a.id] = a.read;
        });
        setReadState(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const severityFilters = ['All', 'High', 'Medium', 'Low'];
  const filtered =
    filter === 'All'
      ? alerts
      : alerts.filter((a) => a.severity === filter);

  const unreadCount = Object.values(readState).filter((v) => !v).length;

  const markAllRead = () => {
    const allRead = {};
    alerts.forEach((a) => {
      allRead[a.id] = true;
    });
    setReadState(allRead);
  };

  const toggleRead = (id) => {
    setReadState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <TopBar
        title="Alerts"
        subtitle={`${unreadCount} unread · ${alerts.length} total`}
      />

      <div className="page-wrapper">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>System Alerts</h1>
              <p>
                All anomaly-triggered alerts, most recent first. Unread alerts are
                highlighted. Click a station ID to drill down.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all var(--transition)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <BellOff size={13} />
                  Mark All Read
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary row */}
        {!loading && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 20,
              flexWrap: 'wrap',
            }}
          >
            {[
              {
                label: 'Unread',
                value: unreadCount,
                color: 'var(--accent-cyan)',
                bg: 'var(--accent-cyan-dim)',
              },
              {
                label: 'High Severity',
                value: alerts.filter((a) => a.severity === 'High').length,
                color: 'var(--status-high)',
                bg: 'var(--status-high-dim)',
              },
              {
                label: 'Medium Severity',
                value: alerts.filter((a) => a.severity === 'Medium').length,
                color: 'var(--status-medium)',
                bg: 'var(--status-medium-dim)',
              },
              {
                label: 'Low / Info',
                value: alerts.filter((a) => a.severity === 'Low').length,
                color: 'var(--status-low)',
                bg: 'var(--status-low-dim)',
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.bg,
                  border: `1px solid ${s.color}33`,
                  borderRadius: 8,
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: s.color,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {severityFilters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 99,
                border: `1px solid ${filter === f ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                background: filter === f ? 'var(--accent-cyan-dim)' : 'transparent',
                color: filter === f ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading alerts…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AnimatePresence>
              {filtered.map((alert, i) => {
                const isRead = readState[alert.id];
                const colors = getAlertColors(alert.severity, isRead);
                const Icon = getAlertIcon(alert.severity);

                return (
                  <motion.div
                    key={alert.id}
                    className={colors.cardClass}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    custom={i}
                    layout
                  >
                    {/* Unread dot */}
                    {!isRead && (
                      <span
                        className="alert-unread-dot"
                        style={{ background: colors.dotColor }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className="alert-icon-wrap"
                      style={{ background: colors.iconBg }}
                    >
                      <Icon size={18} color={colors.iconColor} strokeWidth={2} />
                    </div>

                    {/* Content */}
                    <div className="alert-content">
                      <div className="alert-header-row">
                        <button
                          className="alert-station-id"
                          onClick={() => navigate(`/stations/${alert.station_id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            fontWeight: 'inherit',
                            color: 'inherit',
                            textDecoration: 'underline',
                            textDecorationStyle: 'dotted',
                          }}
                        >
                          {alert.station_id}
                        </button>
                        <SeverityBadge severity={alert.severity} />
                        {!isRead && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--accent-cyan)',
                              background: 'var(--accent-cyan-dim)',
                              padding: '2px 8px',
                              borderRadius: 99,
                              border: '1px solid rgba(0,212,255,0.2)',
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      <div className="alert-message">{alert.alert_message}</div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 14,
                          marginTop: 8,
                          alignItems: 'center',
                        }}
                      >
                        <div className="alert-time" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <Clock size={11} />
                          {formatTime(alert.timestamp)}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            textTransform: 'capitalize',
                          }}
                        >
                          Parameter: {alert.parameter}
                        </span>
                      </div>
                    </div>

                    {/* Mark read toggle */}
                    <button
                      onClick={() => toggleRead(alert.id)}
                      title={isRead ? 'Mark as unread' : 'Mark as read'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: isRead ? 'var(--text-muted)' : 'var(--accent-cyan)',
                        padding: '4px',
                        borderRadius: 6,
                        transition: 'color var(--transition)',
                        flexShrink: 0,
                      }}
                    >
                      {isRead ? (
                        <BellOff size={15} />
                      ) : (
                        <Bell size={15} />
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 0',
                  color: 'var(--status-normal)',
                }}
              >
                <CheckCircle
                  size={32}
                  style={{ display: 'block', margin: '0 auto 12px' }}
                />
                <p style={{ fontSize: 14 }}>No alerts for this filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
