import { CheckCircle2, Database } from 'lucide-react';

/* KPI card — glass, large number, icon + label + optional trend */
export function KpiCard({ icon: Icon, label, value, sub, trend, tint }) {
  const t = tint || { bg: '#DBEAFE', fg: '#2563EB' };
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-icon" style={{ background: t.bg }}>
          <Icon size={15} color={t.fg} strokeWidth={2} />
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value ?? '—'}</div>
      {trend && <div className="kpi-trend" style={{ color: trend.color }}>{trend.text}</div>}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export const TINTS = {
  blue: { bg: '#DBEAFE', fg: '#2563EB' },
  violet: { bg: '#EDE9FE', fg: '#6D28D9' },
  cyan: { bg: '#E0F2FE', fg: '#0284C7' },
  green: { bg: '#DCFCE7', fg: '#15803D' },
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  red: { bg: '#FEE2E2', fg: '#DC2626' },
};

/* Skeleton placeholders matching real layout */
export function KpiSkeleton({ count = 5 }) {
  return (
    <div className="stat-cards-grid" aria-label="Loading metrics" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card" style={{ minHeight: 132 }}>
          <div className="skeleton" style={{ width: 90, height: 14, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '60%', height: 30, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: '80%', height: 12 }} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card" role="status" aria-label="Loading chart">
      <div className="skeleton" style={{ width: 220, height: 16, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 320, height: 12, marginBottom: 18 }} />
      <div className="skeleton" style={{ width: '100%', height: 260 }} />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="card" role="status" aria-label="Loading table">
      <div className="skeleton" style={{ width: 200, height: 16, marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 10 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 14 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <KpiSkeleton count={5} />
      <div className="grid-2 mb-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </>
  );
}

/* Empty states — NO DATA vs NO ANOMALIES are distinct */
export function NoAnomalies({ lastChecked }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><CheckCircle2 size={22} /></span>
      <b>No anomalies detected</b>
      <p>All monitored readings are currently within the expected range.</p>
      {lastChecked && <p style={{ marginTop: 8, fontSize: 12 }}>Last checked: {lastChecked}</p>}
    </div>
  );
}

export function NoData({ title = 'No weather data available', body = 'Upload a CSV file to begin anomaly analysis.', action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" style={{ background: '#E0F2FE', borderColor: '#BAE6FD', color: '#0284C7' }}>
        <Database size={22} />
      </span>
      <b>{title}</b>
      <p>{body}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
