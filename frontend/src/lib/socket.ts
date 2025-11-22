import { io } from 'socket.io-client';

// Use environment variable for Socket.IO URL
// In production, use VITE_SOCKET_URL or fallback to VITE_API_URL
// In development, use localhost or empty string (for Vite proxy)
const socketUrl = import.meta.env.VITE_SOCKET_URL || 
                  (import.meta.env.VITE_API_URL && !import.meta.env.DEV ? import.meta.env.VITE_API_URL : '') ||
                  (import.meta.env.DEV ? 'http://localhost:5050' : '');

export const socket = io(socketUrl || 'http://localhost:5050', { withCredentials: true, autoConnect: false });


