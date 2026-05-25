import React, { createContext, useEffect, useState, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { alertsAPI } from '../services/api';
import { useAuth } from './AuthContext';
import {
  resolveEmergencyLocation,
  canSendEmergency,
} from '../utils/emergencyLocation';

const EmergencyContext = createContext(null);

const SHAKE_THRESHOLD = 3.5;
const MIN_TIME_BETWEEN_SHAKES = 2000;

export const EmergencyProvider = ({ children }) => {
  const { user } = useAuth();
  const lastShakeTimeRef = useRef(0);
  const [shakeEnabled] = useState(true);

  useEffect(() => {
    if (!shakeEnabled || !user) return undefined;

    let subscription;
    Accelerometer.setUpdateInterval(200);

    subscription = Accelerometer.addListener(({ x, y, z }) => {
      const gForce = Math.sqrt(x * x + y * y + z * z);
      if (gForce <= SHAKE_THRESHOLD) return;

      const now = Date.now();
      if (now - lastShakeTimeRef.current <= MIN_TIME_BETWEEN_SHAKES) return;
      lastShakeTimeRef.current = now;
      triggerShakeSos();
    });

    return () => subscription?.remove();
  }, [shakeEnabled, user]);

  const triggerShakeSos = async () => {
    if (!user) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      '🚨 Emergency shake detected',
      'Send an SOS to station staff with your current GPS location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              const location = await resolveEmergencyLocation({
                selectedNodeId: '',
                graphData: null,
              });

              if (!canSendEmergency(location)) {
                Alert.alert(
                  'Location required',
                  'Enable location services so staff can find you, then try again.',
                );
                return;
              }

              await alertsAPI.triggerPanic({
                userId: user._id,
                type: 'panic',
                nodeId: location.nodeId,
                nodeName: location.nodeName,
                floor: location.floor,
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy,
                locationSource: 'shake_gps',
                message: 'Emergency alert triggered by device shake',
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert('SOS sent', 'Station staff have been notified.');
            } catch (e) {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error,
              );
              Alert.alert(
                'Error',
                'Could not send SOS. Please check your connection.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <EmergencyContext.Provider value={{}}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => {
  const ctx = React.useContext(EmergencyContext);
  return ctx;
};
