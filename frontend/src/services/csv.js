/* Minimal RFC-4180 CSV parser + sensor-column mapping.
   Mirrors backend preprocessing aliases. No dependencies. */

const TEMP_KEYS = ['temperature', 'temp_2m_c', 'temp', 'temperature in c', 'temperature (c)', 'temperature_c'];
const HUM_KEYS = ['humidity', 'humidity_percent', 'humidity in %', 'humidity (%)', 'humidity_%', 'rh'];
const PRESS_KEYS = ['pressure', 'pressure_msl_hpa', 'pressure_hpa', 'pressure (hpa)', 'msl_pressure'];
const STATION_KEYS = ['station_id', 'station id', 'station', 'stationid'];
const TIME_KEYS = ['timestamp', 'datetime', 'date', 'time', 'observation_time'];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

export function parseCSV(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  // Auto-detect delimiter (comma vs semicolon) from first non-empty line
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const delim = semis > commas ? ';' : ',';
  const rows = [];
  let cur = [''];
  let inQuotes = false;
  const push = () => { rows.push(cur); cur = ['']; };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
        else inQuotes = false;
      } else cur[cur.length - 1] += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) cur.push('');
    else if (ch === '\n') push();
    else if (ch === '\r') { /* skip, handled by \n */ }
    else cur[cur.length - 1] += ch;
  }
  if (cur.length > 1 || cur[0] !== '') push();
  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => String(h).trim());
  const body = nonEmpty.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows: body };
}

function findKey(headers, candidates) {
  const map = new Map(headers.map((h) => [norm(h), h]));
  for (const c of candidates) {
    const key = norm(c);
    if (map.has(key)) return map.get(key);
  }
  return null;
}

export function mapColumns(headers) {
  return {
    station: findKey(headers, STATION_KEYS),
    time: findKey(headers, TIME_KEYS),
    temperature: findKey(headers, TEMP_KEYS),
    humidity: findKey(headers, HUM_KEYS),
    pressure: findKey(headers, PRESS_KEYS),
  };
}

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Physical plausibility — same ranges as backend preprocessing */
export function validateDataset(headers, rows) {
  const cols = mapColumns(headers);
  const mapped = [cols.station, cols.temperature, cols.humidity, cols.pressure].filter(Boolean);
  const sensorCols = [cols.temperature, cols.humidity, cols.pressure].filter(Boolean);
  let missing = 0;
  let outOfRange = 0;
  rows.forEach((r) => {
    const t = num(r[cols.temperature]);
    const h = num(r[cols.humidity]);
    const p = num(r[cols.pressure]);
    if ((cols.temperature && t == null) || (cols.humidity && h == null) || (cols.pressure && p == null)) missing++;
    if ((t != null && (t < -60 || t > 60)) || (h != null && (h < 0 || h > 100)) || (p != null && (p < 850 || p > 1100))) outOfRange++;
  });
  return {
    cols, mapped, sensorCols,
    rowCount: rows.length,
    hasSensorData: sensorCols.length > 0,
    missing, outOfRange,
    valid: rows.length > 0 && sensorCols.length > 0,
  };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
