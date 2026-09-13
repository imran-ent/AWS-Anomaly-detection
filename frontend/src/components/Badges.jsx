// Severity badge component — always pairs color with text
export function SeverityBadge({ severity }) {
  const cls =
    severity === 'High'
      ? 'badge badge-high'
      : severity === 'Medium'
      ? 'badge badge-medium'
      : severity === 'Low'
      ? 'badge badge-low'
      : 'badge badge-normal';

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
      {severity || 'Normal'}
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
