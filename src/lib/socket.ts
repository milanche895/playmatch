import { io } from 'socket.io-client';

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';

export const socket = io(socketUrl || undefined, { withCredentials: true, autoConnect: false });
