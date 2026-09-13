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
  BarChart,
  Bar,
} from 'recharts';
import {
  Radio,
  AlertTriangle,
  Bell,
  CheckCircle,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { CountUpNumber } from '../components/CountUp';
import { getDashboardSummary, getAnomalyTrend } from '../services/api';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

const STAT_CARDS = [
  {
    key: 'totalStations',
    label: 'Total Stations',
    sub: 'Across India',
    icon: Radio,
    iconBg: 'var(--accent-cyan-dim)',
    iconColor: 'var(--accent-cyan)',
    accent: 'var(--accent-cyan)',
  },
  {
    key: 'anomaliesToday',
    label: 'Anomalies Today',
    sub: 'Detected by ML model',
    icon: AlertTriangle,
    iconBg: 'var(--status-high-dim)',
    iconColor: 'var(--status-high)',
    accent: 'var(--status-high)',
  },
  {
    key: 'activeAlerts',
    label: 'Active Alerts',
    sub: 'Unread / Unresolved',
    icon: Bell,
    iconBg: 'var(--status-medium-dim)',
    iconColor: 'var(--status-medium)',
    accent: 'var(--status-medium)',
  },
  {
    key: 'systemStatus',
    label: 'System Status',
    sub: 'All services running',
    icon: CheckCircle,
    iconBg: 'var(--status-normal-dim)',
    iconColor: 'var(--status-normal)',
    accent: 'var(--status-normal)',
    isText: true,
  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
        }}
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
          {label}
        </p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: '3px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardSummary(), getAnomalyTrend()])
      .then(([s, t]) => {
        setSummary(s);
        setTrend(t);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="AI/ML Anomaly Detection — Real-time AWS Overview"
      />

      <div className="page-wrapper">
        {/* Hero */}
        <motion.div
          className="hero-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="hero-eyebrow">
            <Activity size={12} />
            Live Monitoring System
          </div>
          <h1 className="hero-title">
            <span>AI/ML-Based Intelligent</span>
            <br />
            Anomaly Detection for AWS
          </h1>
          <p className="hero-tagline">
            Real-time anomaly detection across 15 Automatic Weather Stations using
            machine learning. Instantly identifies sensor faults, extreme events, and
            data anomalies — before they become disasters.
          </p>
        </motion.div>

        {/* Stat Cards */}
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span className="loading-text">Loading dashboard…</span>
          </div>
        ) : (
          <>
            <div className="stat-cards-grid">
              {STAT_CARDS.map((card, i) => {
                const Icon = card.icon;
                const val = summary?.[card.key];
                return (
                  <motion.div
                    key={card.key}
                    className="stat-card"
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    custom={i}
                    style={{ '--card-accent': card.accent }}
                  >
                    <div
                      className="stat-card-icon"
                      style={{ background: card.iconBg }}
                    >
                      <Icon size={20} color={card.iconColor} strokeWidth={2} />
                    </div>
                    <div className="stat-card-value">
                      {card.isText ? (
                        <span
                          style={{ fontSize: 22, color: card.iconColor, fontWeight: 800 }}
                        >
                          {val}
                        </span>
                      ) : (
                        <CountUpNumber target={typeof val === 'number' ? val : 0} />
                      )}
                    </div>
                    <div className="stat-card-label">{card.label}</div>
                    <div className="stat-card-sub">{card.sub}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Charts Row */}
            <div className="grid-2">
              {/* 7-day trend area chart */}
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.38 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <TrendingUp size={16} color="var(--accent-cyan)" />
                      7-Day Anomaly Trend
                    </div>
                    <div className="card-subtitle">
                      Anomalies detected per day by severity
                    </div>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#facc15" stopOpacity={0.2} />
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
                        wrapperStyle={{ fontSize: 11, paddingTop: 12, color: 'var(--text-secondary)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="high"
                        name="High"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#gradHigh)"
                      />
                      <Area
                        type="monotone"
                        dataKey="medium"
                        name="Medium"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#gradMedium)"
                      />
                      <Area
                        type="monotone"
                        dataKey="low"
                        name="Low"
                        stroke="#facc15"
                        strokeWidth={2}
                        fill="url(#gradLow)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Daily total bar chart */}
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.38 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <Zap size={16} color="var(--accent-teal)" />
                      Daily Anomaly Count
                    </div>
                    <div className="card-subtitle">Total anomalies per day</div>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#00b4a0" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                        vertical={false}
                      />
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
                      <Bar
                        dataKey="anomalies"
                        name="Anomalies"
                        fill="url(#barGrad)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Quick Links */}
            <motion.div
              className="card mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
            >
              <div className="card-header">
                <div className="card-title">Quick Access</div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                }}
              >
                {[
                  {
                    label: 'Live Weather Data',
                    sub: 'View all station readings',
                    to: '/weather',
                    color: 'var(--accent-cyan)',
                    bg: 'var(--accent-cyan-dim)',
                  },
                  {
                    label: 'Anomaly Monitor',
                    sub: '8 anomalies detected today',
                    to: '/anomalies',
                    color: 'var(--status-high)',
                    bg: 'var(--status-high-dim)',
                  },
                  {
                    label: 'Active Alerts',
                    sub: '3 unread alerts pending',
                    to: '/alerts',
                    color: 'var(--status-medium)',
                    bg: 'var(--status-medium-dim)',
                  },
                ].map((item) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    style={{
                      background: item.bg,
                      border: `1px solid ${item.color}33`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'transform var(--transition), box-shadow var(--transition)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${item.color}22`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: item.color,
                        marginBottom: 4,
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {item.sub}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </>
  );
}
