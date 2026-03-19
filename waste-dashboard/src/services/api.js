import axios from 'axios'

const BASE_URL = 'http://localhost:8000'

// Create axios instance with auth token auto-attach
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// Auto attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto handle 401 errors — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ============ AUTH ============
export const authAPI = {
  login: (email, password) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    return axios.post(`${BASE_URL}/auth/login`, formData)
  },
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
}

// ============ DUSTBINS ============
export const dustbinAPI = {
  getAll: () => api.get('/dustbins/'),
  getOne: (id) => api.get(`/dustbins/${id}`),
  getStats: () => api.get('/dustbins/stats'),
  create: (data) => api.post('/dustbins/', data),
  update: (id, data) => api.put(`/dustbins/${id}`, data),
  delete: (id) => api.delete(`/dustbins/${id}`),
  analyze: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/dustbins/${id}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getQR: (id) => `${BASE_URL}/dustbins/${id}/qr`,
}

// ============ COMPLAINTS ============
export const complaintAPI = {
  getAll: () => api.get('/complaints/'),
  getMy: () => api.get('/complaints/my'),
  getStats: () => api.get('/complaints/stats'),
  getOne: (id) => api.get(`/complaints/${id}`),
  track: (id) => axios.get(`${BASE_URL}/complaints/track/${id}`),
  create: (data) => api.post('/complaints/', data),
  createPublic: (data) => axios.post(`${BASE_URL}/complaints/public`, data),
  update: (id, data) => api.put(`/complaints/${id}`, data),
  assign: (id, data) => api.put(`/complaints/${id}/assign`, data),
  getAnalytics: () => api.get('/complaints/analytics/summary'),
  reset: () => api.delete('/complaints/admin/reset-complaints'),
  firebaseSync: (data) => axios.post(`${BASE_URL}/complaints/firebase-sync`, data),
}

// ============ ROUTES ============
export const routeAPI = {
  getAll: () => api.get('/routes/'),
  getToday: () => api.get('/routes/today'),
  getOptimized: () => axios.get(`${BASE_URL}/routes/optimized`),
  generate: () => api.post('/routes/generate'),
  getGenerated: () => axios.get(`${BASE_URL}/routes/generated`),
  assign: (id, driverName, vanId) =>
    api.put(`/routes/generated/${id}/assign?driver_name=${encodeURIComponent(driverName)}&van_id=${encodeURIComponent(vanId)}`),
  modify: (id, data) => api.put(`/routes/generated/${id}/modify`, data),
  completeStop: (routeId, stopIndex) =>
    api.put(`/routes/generated/${routeId}/stop/${stopIndex}/complete`),
}

// ============ ANALYTICS ============
export const analyticsAPI = {
  overview: () => api.get('/analytics/overview'),
  wasteTrends: () => api.get('/analytics/waste-trends'),
  hotspots: () => api.get('/analytics/hotspots'),
  carbon: () => api.get('/analytics/carbon'),
  predictions: () => api.get('/analytics/predictions'),
  areaComparison: () => api.get('/analytics/area-comparison'),
  peakHours: () => api.get('/analytics/peak-hours'),
}

// ============ ALERTS ============
export const alertAPI = {
  getAll: () => axios.get(`${BASE_URL}/alerts/`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
}

// ============ FLEET ============
export const fleetAPI = {
  getAllTrucks: () => axios.get(`${BASE_URL}/fleet/trucks`),
  getTruck: (id) => axios.get(`${BASE_URL}/fleet/trucks/${id}`),
  updateLocation: (id, data) => axios.put(`${BASE_URL}/fleet/trucks/${id}/location`, data),
  assignRoute: (id, data) => api.put(`/fleet/trucks/${id}/assign`, data),
  getHistory: (id) => axios.get(`${BASE_URL}/fleet/trucks/${id}/history`),
}

// ============ IOT ============
export const iotAPI = {
  getDevices: () => axios.get(`${BASE_URL}/iot/devices`, {
    headers: { 'X-API-Key': 'smartbin-iot-key-2026' }
  }),
}

// ============ HEALTH ============
export const healthAPI = {
  check: () => axios.get(`${BASE_URL}/health`),
}

export default api
