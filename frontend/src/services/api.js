import axios from 'axios';

const REALTIME_URL = import.meta.env.VITE_REALTIME_API_URL || 'http://localhost:5000';
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:5001';

const realtimeAPI = axios.create({ baseURL: `${REALTIME_URL}/api`, timeout: 15000 });
const analyticsAPI = axios.create({ baseURL: `${ANALYTICS_URL}/api`, timeout: 15000 });

// Attach JWT token to every request
const authInterceptor = (config) => {
  const token = localStorage.getItem('sahyatri_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};
realtimeAPI.interceptors.request.use(authInterceptor);
analyticsAPI.interceptors.request.use(authInterceptor);

// Auth
export const authAPI = {
  login: (data) => realtimeAPI.post('/auth/login', data),
  register: (data) => realtimeAPI.post('/auth/register', data),
  me: () => realtimeAPI.get('/auth/me'),
  updatePreferences: (prefs) => realtimeAPI.put('/auth/preferences', prefs),
};

// Alerts
export const alertsAPI = {
  triggerPanic: (data) => realtimeAPI.post('/alerts/panic', data),
  getAll: (params) => realtimeAPI.get('/alerts', { params }),
  getActive: () => realtimeAPI.get('/alerts/active'),
  getMy: () => realtimeAPI.get('/alerts/my'),
  acknowledge: (id) => realtimeAPI.put(`/alerts/${id}/acknowledge`),
  resolve: (id) => realtimeAPI.put(`/alerts/${id}/resolve`),
};

// Crowd
export const crowdAPI = {
  getCurrent: () => realtimeAPI.get('/crowd/current'),
  report: (data) => realtimeAPI.post('/crowd/report', data),
};

// Notifications
export const notificationsAPI = {
  getActive: () => realtimeAPI.get('/notifications'),
  broadcast: (data) => realtimeAPI.post('/notifications', data),
  deactivate: (id) => realtimeAPI.put(`/notifications/${id}/deactivate`),
};

// Analytics
export const analyticsAPI_req = {
  logNavigation: (data) => analyticsAPI.post('/analytics/navigation', data),
  logCrowd: (data) => analyticsAPI.post('/analytics/crowd', data),
  getCrowdHistory: (params) => analyticsAPI.get('/analytics/crowd/history', { params }),
  getPeakHours: (params) => analyticsAPI.get('/analytics/peak-hours', { params }),
  getPopularRoutes: () => analyticsAPI.get('/analytics/popular-routes'),
  getUsageStats: () => analyticsAPI.get('/analytics/usage-stats'),
  getCrowdSummary: () => analyticsAPI.get('/analytics/crowd/summary'),
};

// GeoJSON (served by realtime server)
export const geoAPI = {
  getStation: () => axios.get(`${REALTIME_URL}/geo/railway_station.geojson`),
  getGraph: () => axios.get(`${REALTIME_URL}/geo/station_graph.json`),
  getOutsideConnections: () => axios.get(`${REALTIME_URL}/geo/outside_connections.json`),
};
