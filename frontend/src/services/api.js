/**
 * API Service Layer — AWS Anomaly Detection Dashboard
 *
 * Currently reads from local JSON mock data.
 * Replace the import-based implementations with the fetch() calls
 * shown in comments once the FastAPI backend is ready.
 *
 * Backend base URL will be something like: http://localhost:8000 or https://api.yourdomain.com
 */

import stationsData from '../data/stations.json';
import anomaliesData from '../data/anomalies.json';
import alertsData from '../data/alerts.json';
import historyData from '../data/history.json';

// ─── Simulated network delay (remove in production) ──────────────────────────
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── GET /stations ────────────────────────────────────────────────────────────
/**
 * Returns all weather stations with current readings.
 */
export async function getStations() {
  await delay();
  return stationsData;

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/stations`);
  if (!response.ok) throw new Error('Failed to fetch stations');
  return response.json();
  */
}

// ─── GET /stations/:id ────────────────────────────────────────────────────────
/**
 * Returns a single station by its station_id.
 * @param {string} id - e.g. "AWS001"
 */
export async function getStationById(id) {
  await delay();
  const station = stationsData.find((s) => s.station_id === id);
  if (!station) throw new Error(`Station ${id} not found`);
  return station;

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/stations/${id}`);
  if (!response.ok) throw new Error(`Failed to fetch station ${id}`);
  return response.json();
  */
}

// ─── GET /anomalies ───────────────────────────────────────────────────────────
/**
 * Returns all anomaly records, sorted by timestamp descending.
 * @param {string} [stationId] - optional filter by station_id
 */
export async function getAnomalies(stationId = null) {
  await delay();
  let data = [...anomaliesData];
  if (stationId) {
    data = data.filter((a) => a.station_id === stationId);
  }
  return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  /*
  // FastAPI equivalent:
  const url = stationId
    ? `${BASE_URL}/anomalies?station_id=${stationId}`
    : `${BASE_URL}/anomalies`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch anomalies');
  return response.json();
  */
}

// ─── GET /alerts ──────────────────────────────────────────────────────────────
/**
 * Returns all alert records, sorted most-recent-first.
 */
export async function getAlerts() {
  await delay();
  return [...alertsData].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/alerts`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
  */
}

// ─── GET /stations/:id/history ────────────────────────────────────────────────
/**
 * Returns the 24-hour sensor history for a given station.
 * @param {string} id - e.g. "AWS001"
 */
export async function getStationHistory(id) {
  await delay();
  const history = historyData[id];
  if (!history) return [];
  return history;

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/stations/${id}/history`);
  if (!response.ok) throw new Error(`Failed to fetch history for ${id}`);
  return response.json();
  */
}

// ─── GET /dashboard/summary ───────────────────────────────────────────────────
/**
 * Returns summary stats for the dashboard hero cards.
 * Computed from local data; backend may expose a dedicated endpoint.
 */
export async function getDashboardSummary() {
  await delay(150);
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

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/dashboard/summary`);
  if (!response.ok) throw new Error('Failed to fetch dashboard summary');
  return response.json();
  */
}

// ─── GET /anomalies/trend ─────────────────────────────────────────────────────
/**
 * Returns 7-day anomaly trend data for the dashboard chart.
 */
export async function getAnomalyTrend() {
  await delay(150);
  // Mock 7-day trend — backend should compute this from time-series DB
  return [
    { date: 'Sep 6', anomalies: 2, high: 0, medium: 1, low: 1 },
    { date: 'Sep 7', anomalies: 4, high: 1, medium: 2, low: 1 },
    { date: 'Sep 8', anomalies: 3, high: 0, medium: 2, low: 1 },
    { date: 'Sep 9', anomalies: 5, high: 2, medium: 1, low: 2 },
    { date: 'Sep 10', anomalies: 6, high: 2, medium: 3, low: 1 },
    { date: 'Sep 11', anomalies: 5, high: 1, medium: 3, low: 1 },
    { date: 'Sep 12', anomalies: 8, high: 4, medium: 3, low: 1 },
  ];

  /*
  // FastAPI equivalent:
  const response = await fetch(`${BASE_URL}/anomalies/trend?days=7`);
  if (!response.ok) throw new Error('Failed to fetch anomaly trend');
  return response.json();
  */
}
