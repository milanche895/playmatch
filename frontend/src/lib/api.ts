import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

// Authentication is handled via HttpOnly cookies (set by backend).
// withCredentials: true ensures cookies are sent on every request.
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000
});

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


