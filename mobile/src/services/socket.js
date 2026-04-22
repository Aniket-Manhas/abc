import { io } from 'socket.io-client';
import storage from './storage';
import { REALTIME_URL } from './api';

let socket = null;

export const connectSocket = async (token) => {
  if (socket?.connected) return;
  const t = token || await storage.getItem('sahyatri_token');
  console.log('[Socket] Connecting to', REALTIME_URL);
  socket = io(REALTIME_URL, {
    auth: { token: t },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 20,
    timeout: 10000,
  });
  socket.on('connect', () => console.log('[Socket] Connected'));
  socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
  socket.on('reconnect_attempt', (attempt) => console.log('[Socket] Reconnect attempt:', attempt));
  socket.on('connect_error', (e) => {
    console.warn('[Socket] Error:', e?.message, {
      description: e?.description,
      type: e?.type,
      transport: socket?.io?.engine?.transport?.name,
    });
  });
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = () => socket;
