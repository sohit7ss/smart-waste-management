import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const fetchDustbins = () => api.get('/dustbins');
export const fetchDustbin = (id) => api.get(`/dustbins/${id}`);
export const fetchComplaints = () => api.get('/complaints');
export const fetchOptimizedRoute = () => api.get('/optimized-route');
export const submitReport = (location, description) =>
  api.post(`/report?location=${encodeURIComponent(location)}&description=${encodeURIComponent(description)}`);
export const analyzeImage = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export default api;
