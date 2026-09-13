/**
 * API Service Layer — METEORA AWS Anomaly Detection Dashboard
 * Now connected to FastAPI backend at VITE_API_URL or http://localhost:8000
 * Falls back to local JSON mock data if backend is unreachable (for offline demo).
 */

import stationsData from '../data/stations.json';
import anomaliesData from '../data/anomalies.json';
import alertsData from '../data/alerts.json';
import historyData from '../data/history.json';

// Backend base URL: must match uvicorn host (127.0.0.1). Use VITE_API_URL; fallback to 127.0.0.1 to avoid localhost↔127 mismatch.
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : 'http://127.0.0.1:8000';

// Helper: fetch with fallback
async function fetchWithFallback(url, fallbackFn) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn(`Backend fetch failed for ${url}: ${e.message} — using mock fallback`);
    return fallbackFn();
  }
}

// ─── GET /stations ────────────────────────────────────────────────────────────
export async function getStations() {
  return fetchWithFallback(`${BASE_URL}/api/stations`, async () => stationsData);
}

// ─── GET /stations/:id ────────────────────────────────────────────────────────
export async function getStationById(id) {
  return fetchWithFallback(`${BASE_URL}/api/stations/${id}`, async () => {
    const station = stationsData.find((s) => s.station_id === id);
    if (!station) throw new Error(`Station ${id} not found`);
    return station;
  });
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
  });
}

// ─── GET /alerts ──────────────────────────────────────────────────────────────
export async function getAlerts() {
  return fetchWithFallback(`${BASE_URL}/api/alerts`, async () => {
    return [...alertsData].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  });
}

// ─── GET /stations/:id/history ────────────────────────────────────────────────
export async function getStationHistory(id) {
  return fetchWithFallback(`${BASE_URL}/api/stations/${id}/history`, async () => {
    const history = historyData[id];
    if (!history) return [];
    return history;
  });
}

// ─── GET /dashboard/summary ───────────────────────────────────────────────────
export async function getDashboardSummary() {
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
    };
  });
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
  });
}

// Extra helpers for direct backend inspection
export async function getWeather(limit = 20) {
  return fetchWithFallback(`${BASE_URL}/api/weather?limit=${limit}`, async () => []);
}
export async function getDetect(limit = 50) {
  return fetchWithFallback(`${BASE_URL}/api/detect?limit=${limit}`, async () => []);
}
