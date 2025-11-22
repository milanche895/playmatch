import axios from 'axios';

// In development, use empty string to use Vite proxy (better for cookies)
// In production, use explicit URL or environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:5050'),
  withCredentials: true
});

export default api;


