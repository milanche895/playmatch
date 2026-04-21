import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5050';

export const socket = io(socketUrl, { withCredentials: true, autoConnect: false });


