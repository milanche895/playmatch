import axios from 'axios';

// Always use explicit backend URL (port 5050), not Vite proxy
// This ensures all API calls go directly to the backend
const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050',
  withCredentials: true,
  timeout: 10000
});

// Add request interceptor to include token in Authorization header
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log error for debugging
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Error: No response received', error.request);
    } else {
      // Something else happened
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;


