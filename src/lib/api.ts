import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // First dev compile of an API route can take well over 10s; a short timeout
  // aborts the request and the UI treats it as "no response".
  timeout: 60000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const canceled = error.code === 'ERR_CANCELED' || error.name === 'CanceledError';
    if (canceled) {
      return Promise.reject(error);
    }
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('API Error: No response received', error.message || error.code);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
