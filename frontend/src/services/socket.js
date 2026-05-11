import { io } from 'socket.io-client';

const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultSocketUrl = `http://${browserHost}:5000`;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultSocketUrl;

let socket = null;

export const getSocket = () => socket;

export const connectSocket = (token = null) => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔴 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚠️ Socket connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
