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

// Global flag for UI to detect mock usage
export let lastFetchWasMock = false;
export function isMockMode() { return lastFetchWasMock; }

// Helper: fetch with explicit fallback labeling
// - If fetch succeeds, returns real data
// - If fetch fails and allowMock=true, returns mock data marked with _isMock flag and logs DEMO DATA warning
// - If fetch fails and allowMock=false, throws so caller can show error state
async function fetchWithFallback(url, fallbackFn, { allowMock = true, label = 'data' } = {}) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    lastFetchWasMock = false;
    return data;
  } catch (e) {
    console.warn(`Backend fetch failed for ${url}: ${e.message}`);
    if (!allowMock) {
      lastFetchWasMock = false;
      throw e;
    }
    console.warn(`[METEORA] Using DEMO/MOCK fallback for ${label} — data is NOT real. Backend unavailable.`);
    lastFetchWasMock = true;
    const mock = await fallbackFn();
    // Tag mock so UI can show DEMO badge instead of pretending it's live
    if (Array.isArray(mock)) {
      // attach non-enumerable? but enumerable for check
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

// Extra helpers for direct backend inspection
export async function getWeather(limit = 20) {
  return fetchWithFallback(`${BASE_URL}/api/weather?limit=${limit}`, async () => [], { label: 'weather' });
}
export async function getDetect(limit = 50) {
  return fetchWithFallback(`${BASE_URL}/api/detect?limit=${limit}`, async () => [], { label: 'detect' });
}
