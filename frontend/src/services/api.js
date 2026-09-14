/**
 * API Service Layer — METEORA AWS Anomaly Detection Dashboard
 * Now connected to FastAPI backend at VITE_API_URL or http://localhost:8000
 * Mock fallback is retained ONLY for offline demo and is explicitly labeled as DEMO DATA.
 * Production: if backend is reachable, real data MUST be used. If backend fails,
 * we propagate the error so UI can show "Backend unavailable" instead of silently showing fake data.
 */

import stationsData from '../data/stations.json';
import anomaliesData from '../data/anomalies.json';
import alertsData from '../data/alerts.json';
import historyData from '../data/history.json';

// Backend base URL: must match uvicorn host (127.0.0.1). Use VITE_API_URL; fallback to 127.0.0.1 to avoid localhost↔127 mismatch.
export const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : 'http://127.0.0.1:8000';

// Mock mode: controlled by env. Production MUST NOT silently use mock.
// Set VITE_USE_MOCK_DATA=true for offline demo, false for production (shows Backend unavailable error)
const USE_MOCK = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK_DATA)
  ? String(import.meta.env.VITE_USE_MOCK_DATA).toLowerCase() === 'true'
  : true; // default true for local dev convenience, but UI clearly shows DEMO badge

// Global flag for UI to detect mock usage
export let lastFetchWasMock = false;
export function isMockMode() { return lastFetchWasMock; }

// Helper: fetch with explicit fallback labeling
// - If fetch succeeds, returns real data
// - If fetch fails and allowMock=true AND USE_MOCK=true, returns mock data marked with _isMock flag
// - Otherwise throws so caller can show "Backend connection unavailable" error (production behavior)
async function fetchWithFallback(url, fallbackFn, { allowMock = true, label = 'data' } = {}) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    lastFetchWasMock = false;
    return data;
  } catch (e) {
    console.warn(`Backend fetch failed for ${url}: ${e.message}`);
    const mockAllowed = allowMock && USE_MOCK;
    if (!mockAllowed) {
      lastFetchWasMock = false;
      // Production: do not hide failure with fake data
      throw e;
    }
    console.warn(`[METEORA] Using DEMO/MOCK fallback for ${label} — data is NOT real. Backend unavailable. Set VITE_USE_MOCK_DATA=false to disable mock in production.`);
    lastFetchWasMock = true;
    const mock = await fallbackFn();
    if (Array.isArray(mock)) {
      mock._isMock = true;
    } else if (mock && typeof mock === 'object') {
      mock._isMock = true;
      mock._demoLabel = 'DEMO DATA';
    }
    return mock;
  }
}

// Health check helper — no fallback, purely backend status
export async function getHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

// ─── GET /stations ────────────────────────────────────────────────────────────
export async function getStations() {
  return fetchWithFallback(`${BASE_URL}/api/stations`, async () => stationsData, { label: 'stations' });
}

// ─── GET /stations/:id ────────────────────────────────────────────────────────
export async function getStationById(id) {
  return fetchWithFallback(`${BASE_URL}/api/stations/${id}`, async () => {
    const station = stationsData.find((s) => s.station_id === id);
    if (!station) throw new Error(`Station ${id} not found`);
    return station;
  }, { label: `station ${id}` });
}

// ─── GET /anomalies ───────────────────────────────────────────────────────────
export async function getAnomalies(stationId = null) {
  const url = stationId
    ? `${BASE_URL}/api/anomalies?station_id=${stationId}`
    : `${BASE_URL}/api/anomalies`;
  return fetchWithFallback(url, async () => {
    let data = [...anomaliesData];
    if (stationId) data = data.filter((a) => a.station_id === stationId);
    return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, { label: 'anomalies' });
}

// ─── GET /alerts ──────────────────────────────────────────────────────────────
export async function getAlerts() {
  return fetchWithFallback(`${BASE_URL}/api/alerts`, async () => {
    return [...alertsData].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, { label: 'alerts' });
}

// ─── GET /stations/:id/history ────────────────────────────────────────────────
export async function getStationHistory(id) {
  return fetchWithFallback(`${BASE_URL}/api/stations/${id}/history`, async () => {
    const history = historyData[id];
    if (!history) return [];
    return history;
  }, { label: `history ${id}` });
}

// ─── GET /dashboard/summary ───────────────────────────────────────────────────
export async function getDashboardSummary() {
  // For dashboard summary we prefer to surface backend error rather than hide it with mock 15 stations
  // Keep mock as offline fallback but marked DEMO DATA
  return fetchWithFallback(`${BASE_URL}/api/dashboard/summary`, async () => {
    const stations = stationsData;
    const anomalies = anomaliesData;
    const alerts = alertsData;
    const today = new Date().toISOString().slice(0, 10);
    return {
      totalStations: stations.length,
      anomaliesToday: anomalies.filter((a) => a.timestamp.startsWith(today)).length,
      activeAlerts: alerts.filter((a) => !a.read).length,
      systemStatus: 'Operational',
      _isMock: true,
      _demoLabel: 'DEMO DATA — backend unavailable',
    };
  }, { label: 'dashboard summary' });
}

// ─── GET /anomalies/trend ─────────────────────────────────────────────────────
export async function getAnomalyTrend() {
  return fetchWithFallback(`${BASE_URL}/api/anomalies/trend?days=7`, async () => {
    return [
      { date: 'Sep 6', anomalies: 2, high: 0, medium: 1, low: 1 },
      { date: 'Sep 7', anomalies: 4, high: 1, medium: 2, low: 1 },
      { date: 'Sep 8', anomalies: 3, high: 0, medium: 2, low: 1 },
      { date: 'Sep 9', anomalies: 5, high: 2, medium: 1, low: 2 },
      { date: 'Sep 10', anomalies: 6, high: 2, medium: 3, low: 1 },
      { date: 'Sep 11', anomalies: 5, high: 1, medium: 3, low: 1 },
      { date: 'Sep 12', anomalies: 8, high: 4, medium: 3, low: 1 },
    ];
  }, { label: 'anomaly trend' });
}

// ─── Manual Sensor Check ────────────────────────────────────────────────────
export async function getManualStations() {
  // prefers dedicated manual stations endpoint, falls back to full stations
  try {
    const res = await fetch(`${BASE_URL}/api/manual/stations`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // data is {total, stations:[{station_id,city}]}
    if (data && data.stations) return data;
    return data;
  } catch (e) {
    // fallback to existing stations endpoint
    console.warn(`Manual stations fetch failed, trying /api/stations: ${e.message}`);
    const stations = await getStations();
    // normalize to {total, stations}
    if (Array.isArray(stations)) {
      return {
        total: stations.length,
        stations: stations.map((s) => ({ station_id: s.station_id, city: s.city || s.location })),
      };
    }
    return stations;
  }
}

export async function manualSensorCheck({ station_id, temperature, humidity, pressure }) {
  // Try canonical /api/manual-check first, fallback to /api/predict per spec
  const tryFetch = async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id, temperature, humidity, pressure }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.detail || data.error || data.message || `Manual check failed: ${res.status}`;
      throw new Error(msg);
    }
    return data;
  };
  try {
    return await tryFetch(`${BASE_URL}/api/manual-check`);
  } catch (e) {
    // If manual-check 404, try /api/predict spec endpoint
    if (String(e.message).includes('404') || String(e.message).includes('Not Found')) {
      return await tryFetch(`${BASE_URL}/api/predict`);
    }
    throw e;
  }
}

// Spec-required POST /api/predict (with rainfall/wind optional) — direct access
export async function predictSensor({ station_id, temperature, humidity, pressure, rainfall, wind_speed }) {
  const body = { station_id, temperature, humidity, pressure };
  if (rainfall != null) body.rainfall = rainfall;
  if (wind_speed != null) body.wind_speed = wind_speed;
  const res = await fetch(`${BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.detail || data.error || `Predict failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Extra helpers for direct backend inspection
export async function getWeather(limit = 20) {
  return fetchWithFallback(`${BASE_URL}/api/weather?limit=${limit}`, async () => [], { label: 'weather' });
}
export async function getDetect(limit = 50) {
  return fetchWithFallback(`${BASE_URL}/api/detect?limit=${limit}`, async () => [], { label: 'detect' });
}
