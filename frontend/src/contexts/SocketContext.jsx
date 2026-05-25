import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";
import { playAlertBeep, stopAlertBeep, unlockAudio } from "../utils/audio";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [crowdData, setCrowdData] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const listenersRef = useRef({});

  const [hasActiveDanger, setHasActiveDanger] = useState(false);

  // Unlock audio on first user gesture to prevent browser autoplay block
  useEffect(() => {
    const handleUnlock = () => {
      unlockAudio();
      window.removeEventListener("click", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };
    window.addEventListener("click", handleUnlock);
    window.addEventListener("keydown", handleUnlock);
    return () => {
      window.removeEventListener("click", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };
  }, []);

  useEffect(() => {
    // Check for danger across all crowd data with robust case-insensitive check
    const danger = Object.values(crowdData).some((v) => {
      const d = typeof v === "string" ? v : v?.density;
      return ["high", "danger", "critical"].includes(String(d || "").toLowerCase());
    });

    // Logging alert states for immediate diagnostics
    console.log("Crowd Data Alert Assessment:", { crowdData, danger, isMuted, isAlarmActive });

    setHasActiveDanger(danger);

    if (!danger && isMuted) {
      setIsMuted(false); // Reset mute state automatically once the situation is safe
    }

    if (danger && !isMuted && !isAlarmActive) {
      setIsAlarmActive(true);
      playAlertBeep();
    }

    if ((!danger || isMuted) && isAlarmActive) {
      setIsAlarmActive(false);
      stopAlertBeep();
    }
  }, [crowdData, isMuted, isAlarmActive]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onCrowdUpdate = (data) => {
      setCrowdData((prev) => ({ ...prev, ...data }));
    };

    const onNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 9)]);
    };

    const onNewAlert = (alert) => {
      setAdminAlerts((prev) => [alert, ...prev]);
    };

    const onAlertUpdated = (alert) => {
      setAdminAlerts((prev) =>
        prev.map((a) => (a._id === alert._id ? alert : a)),
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("crowd:update", onCrowdUpdate);
    socket.on("notification:receive", onNotification);
    socket.on("alert:new", onNewAlert);
    socket.on("alert:updated", onAlertUpdated);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("crowd:update", onCrowdUpdate);
      socket.off("notification:receive", onNotification);
      socket.off("alert:new", onNewAlert);
      socket.off("alert:updated", onAlertUpdated);
    };
  }, [token, user]);

  const dismissNotification = useCallback((index) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const emitLocation = useCallback((locationData) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit("user:location", locationData);
  }, []);

  const reportCameraData = useCallback((data) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit("crowd:camera_report", data);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        connected,
        crowdData,
        notifications,
        adminAlerts,
        dismissNotification,
        emitLocation,
        reportCameraData,
        setAdminAlerts,
        isAlarmActive,
        setIsMuted,
        isMuted,
      }}
    >
      {children}
      {hasActiveDanger && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: isMuted
              ? "rgba(55, 65, 81, 0.95)"
              : "rgba(239, 68, 68, 0.95)",
            color: "white",
            padding: "1rem 2rem",
            borderRadius: "50px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            border: "2px solid rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "1.1rem",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ animation: isMuted ? "none" : "pulse 1s infinite" }}>
              🚨
            </span>
            {isMuted ? "STAMPEDE ALARM SILENCED" : "STAMPEDE RISK DETECTED"}
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            style={{
              background: "white",
              color: isMuted ? "#374151" : "#ef4444",
              border: "none",
              padding: "0.5rem 1.25rem",
              borderRadius: "25px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.9rem",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {isMuted ? "🔊 Unmute Alarm" : "🔇 Silence Alarm"}
          </button>
        </div>
      )}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
