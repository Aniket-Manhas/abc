import axios from 'axios';
import storage from './storage';

// ── Backend URLs ─────────────────────────────────────────────
const REALTIME_URL  = 'http://192.168.29.37:5000';
const ANALYTICS_URL = 'http://192.168.29.37:5001';
const INDOOR_NAV_URL = 'http://192.168.29.37:4000';

const realtimeAPI  = axios.create({ baseURL: `${REALTIME_URL}/api` });
const analyticsAPI = axios.create({ baseURL: `${ANALYTICS_URL}/api` });

// ── Attach JWT token to every request ───────────────────────
const authInterceptor = async (config) => {
  const token = await storage.getItem('sahyatri_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};
realtimeAPI.interceptors.request.use(authInterceptor);
analyticsAPI.interceptors.request.use(authInterceptor);

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  login:             (data)  => realtimeAPI.post('/auth/login', data),
  register:          (data)  => realtimeAPI.post('/auth/register', data),
  me:                ()      => realtimeAPI.get('/auth/me'),
  updatePreferences: (prefs) => realtimeAPI.put('/auth/preferences', prefs),
};

// ── Alerts ───────────────────────────────────────────────────
export const alertsAPI = {
  triggerPanic: (data) => realtimeAPI.post('/alerts/panic', data),
  getAll:       (p)    => realtimeAPI.get('/alerts', { params: p }),
  getActive:    ()     => realtimeAPI.get('/alerts/active'),
  getMy:        ()     => realtimeAPI.get('/alerts/my'),
  acknowledge:  (id)   => realtimeAPI.put(`/alerts/${id}/acknowledge`),
  resolve:      (id)   => realtimeAPI.put(`/alerts/${id}/resolve`),
};

// ── Crowd ─────────────────────────────────────────────────────
export const crowdAPI = {
  getCurrent: ()     => realtimeAPI.get('/crowd/current'),
  report:     (data) => realtimeAPI.post('/crowd/report', data),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationsAPI = {
  getActive:  ()     => realtimeAPI.get('/notifications'),
  broadcast:  (data) => realtimeAPI.post('/notifications', data),
  deactivate: (id)   => realtimeAPI.put(`/notifications/${id}/deactivate`),
};

// ── Analytics ─────────────────────────────────────────────────
export const analyticsAPI_req = {
  logNavigation:   (data)   => analyticsAPI.post('/analytics/navigation', data),
  logCrowd:        (data)   => analyticsAPI.post('/analytics/crowd', data),
  getCrowdHistory: (params) => analyticsAPI.get('/analytics/crowd/history', { params }),
};

// ── Indoor Navigation API (indoor navigation/backend, port 4000) ───
export const indoorNavAPI = {
  /**
   * Fetches the full GeoJSON floor plan (rooms, boundaries, corridors).
   * Used to render the interactive SVG map.
   */
  getGeoJson: () => axios.get(`${INDOOR_NAV_URL}/api/geojson`),

  /**
   * Loads a specific map (College or Jammu Station) into the backend engine.
   */
  loadMap: (useJammu) => axios.post(`${INDOOR_NAV_URL}/api/load-map`, {
    useJammu: useJammu,
    useCollege: !useJammu
  }),

  /**
   * Computes a route from a lat/lng position to a room ID.
   * @param {number} fromLat  - User latitude
   * @param {number} fromLng  - User longitude
   * @param {string} toRoomId - Destination room ID (from GeoJSON properties.roomId)
   * @param {boolean} accessible - If true, avoids stairs
   * Returns: { ok, coordinates: [[lng, lat], ...], outsideApproach }
   */
  getRoute: (fromLat, fromLng, toRoomId, accessible = false) => {
    const params = new URLSearchParams({
      from: `${fromLat},${fromLng}`,
      to:   toRoomId,
      floor: '0',
    });
    if (accessible) params.set('accessible', 'true');
    return axios.get(`${INDOOR_NAV_URL}/api/route?${params}`);
  },

  /**
   * Health check for the indoor navigation backend.
   */
  getStatus: () => axios.get(`${INDOOR_NAV_URL}/api/map-status`),
};

// ── Legacy geo API (kept for MapScreen outdoor map) ───────────────
export const geoAPI = {
  // Outdoor station GeoJSON for the map marker — still served by realtime-server
  getStation: () => axios.get(`${REALTIME_URL}/geo/railway_station.geojson`),
  
  // Re-enable getGraph for backward compatibility using indoor navigation geojson
  getGraph: async () => {
    try {
      const res = await indoorNavAPI.getGeoJson();
      const features = res.data?.features || [];
      const nodes = {};
      
      features.forEach(f => {
        if (f.properties && (f.properties.type === 'room' || f.properties.type === 'node')) {
          const id = f.properties.name || f.id || Math.random().toString();
          nodes[id] = {
            id,
            name: f.properties.name.replace(/_/g, ' ') || id,
            type: f.properties.type,
            floor: f.properties.floor || 0,
          };
        }
      });
      return { data: { nodes } };
    } catch (err) {
      console.warn("getGraph mock failed:", err);
      return { data: { nodes: {} } };
    }
  }
};

export { REALTIME_URL, ANALYTICS_URL, INDOOR_NAV_URL };
