// Severity badge — Low=blue, Medium=amber, High/Critical=red. Always pairs color with text.
export function SeverityBadge({ severity }) {
  const s = String(severity || 'Normal').toLowerCase();
  const cls =
    s === 'high' || s === 'critical'
      ? 'badge badge-high'
      : s === 'medium'
      ? 'badge badge-medium'
      : s === 'low'
      ? 'badge badge-low'
      : 'badge badge-normal';

  const label = s === 'critical' ? 'Critical' : s === 'high' ? 'High' : s === 'medium' ? 'Medium' : s === 'low' ? 'Low' : 'Normal';

  const dot = (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'currentColor',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );

  return (
    <span className={cls}>
      {dot}
      {label}
    </span>
  );
}

// Status badge for anomaly_status boolean
export function StatusBadge({ anomalyStatus }) {
  return anomalyStatus ? (
    <span className="badge badge-high">
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'currentColor', display: 'inline-block',
        }}
      />
      Anomaly
    </span>
  ) : (
    <span className="badge badge-normal">
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'currentColor', display: 'inline-block',
        }}
      />
      Normal
    </span>
  );
}

// Format timestamp to readable string
export function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}
