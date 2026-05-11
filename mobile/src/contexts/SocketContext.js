import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [connected, setConnected]       = useState(false);
  const [crowdData, setCrowdData]       = useState({});
  const [notifications, setNotifications] = useState([]);
  const [adminAlerts, setAdminAlerts]   = useState([]);

  useEffect(() => {
    let retryId = null;
    let cleanup = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const onConnect    = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onCrowdUpdate  = (data) => setCrowdData(prev => ({ ...prev, ...data }));
      const onNotification = (notif) => setNotifications(prev => [notif, ...prev.slice(0, 9)]);
      const onNewAlert     = (alert) => setAdminAlerts(prev => [alert, ...prev]);
      const onAlertUpdated = (alert) => setAdminAlerts(prev => prev.map(a => a._id === alert._id ? alert : a));

      socket.on('connect',              onConnect);
      socket.on('disconnect',           onDisconnect);
      socket.on('crowd:update',         onCrowdUpdate);
      socket.on('notification:receive', onNotification);
      socket.on('alert:new',            onNewAlert);
      socket.on('alert:updated',        onAlertUpdated);

      // If already connected when we attach, set state immediately
      if (socket.connected) setConnected(true);

      cleanup = () => {
        socket.off('connect',              onConnect);
        socket.off('disconnect',           onDisconnect);
        socket.off('crowd:update',         onCrowdUpdate);
        socket.off('notification:receive', onNotification);
        socket.off('alert:new',            onNewAlert);
        socket.off('alert:updated',        onAlertUpdated);
      };
      return true;
    };

    if (!attach()) {
      // Socket not created yet — retry every 150ms until available
      retryId = setInterval(() => {
        if (attach()) clearInterval(retryId);
      }, 150);
    }

    return () => {
      if (retryId) clearInterval(retryId);
      cleanup?.();
    };
  }, [token]);

  const dismissNotification = useCallback((index) =>
    setNotifications(prev => prev.filter((_, i) => i !== index)), []);

  const emitLocation = useCallback((locationData) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('user:location', locationData);
  }, []);

  const reportCrowdDensity = useCallback((data) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('crowd:camera_report', data);
  }, []);

  return (
    <SocketContext.Provider value={{
      connected, crowdData, notifications, adminAlerts,
      dismissNotification, emitLocation, reportCrowdDensity, setAdminAlerts, setNotifications,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside SocketProvider');
  return ctx;
};
