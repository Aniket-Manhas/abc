import React, { createContext, useContext, useEffect, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { alertsAPI } from '../services/api';
import { useAuth } from './AuthContext';

const EmergencyContext = createContext(null);

const SHAKE_THRESHOLD = 3.5; // g-force threshold for a violent shake
const MIN_TIME_BETWEEN_SHAKES = 2000; // ms

export const EmergencyProvider = ({ children }) => {
  const { user } = useAuth();
  const [lastShakeTime, setLastShakeTime] = useState(0);

  useEffect(() => {
    let subscription;

    const subscribe = async () => {
      // Set update interval
      Accelerometer.setUpdateInterval(200);

      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const gForce = Math.sqrt(x * x + y * y + z * z);
        
        if (gForce > SHAKE_THRESHOLD) {
          const now = Date.now();
          if (now - lastShakeTime > MIN_TIME_BETWEEN_SHAKES) {
            setLastShakeTime(now);
            triggerShakeSos();
          }
        }
      });
    };

    subscribe();
    return () => subscription && subscription.remove();
  }, [lastShakeTime, user]);

  const triggerShakeSos = async () => {
    // Only logged in passengers should trigger real alerts
    if (!user) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // We confirm with the user heavily before actually firing the API, 
    // to prevent accidental shakes in the pocket.
    Alert.alert(
      "🚨 EMERGENCY SHAKE DETECTED",
      "Do you want to send an SOS to station staff?",
      [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        { 
          text: "SEND SOS", 
          style: "destructive",
          onPress: async () => {
            try {
              await alertsAPI.triggerPanic({
                userId: user._id,
                type: 'panic',
                nodeId: 'unknown',
                nodeName: 'Triggered via Shake',
                floor: 0,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("SOS Sent", "Station staff have been notified.");
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Could not send SOS. Please check connection.");
            }
          }
        }
      ]
    );
  };

  return (
    <EmergencyContext.Provider value={{}}>
      {children}
    </EmergencyContext.Provider>
  );
};
