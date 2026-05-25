import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { alertsAPI } from '../services/api';
import {
  resolveEmergencyLocation,
  canSendEmergency,
} from '../utils/emergencyLocation';
import { colors, spacing, radius } from '../theme';

const LONG_PRESS_MS = 2000;

export default function PanicButton({ selectedNodeId, graphData, userId }) {
  const [state, setState] = React.useState('idle');
  const pulse = useRef(new Animated.Value(1)).current;
  const anim = useRef(null);
  const pressAnimValue = useRef(new Animated.Value(0)).current;
  const longPressTriggered = useRef(false);
  const progressAnim = useRef(null);

  useEffect(() => {
    anim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.07,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.current.start();
    return () => anim.current?.stop();
  }, []);

  const resetProgress = useCallback(() => {
    progressAnim.current?.stop();
    pressAnimValue.setValue(0);
  }, [pressAnimValue]);

  const startHoldProgress = useCallback(() => {
    resetProgress();
    progressAnim.current = Animated.timing(pressAnimValue, {
      toValue: 100,
      duration: LONG_PRESS_MS,
      useNativeDriver: false,
    });
    progressAnim.current.start();
  }, [pressAnimValue, resetProgress]);

  const sendSOS = useCallback(
    async (via = 'button') => {
      if (!userId) {
        Alert.alert(
          'Sign in required',
          'Please log in to send an emergency alert.',
        );
        return;
      }

      setState('sending');
      try {
        const location = await resolveEmergencyLocation({
          selectedNodeId,
          graphData,
        });

        if (!canSendEmergency(location)) {
          setState('error');
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
          Alert.alert(
            'Location required',
            'Turn on location services or select where you are on the map above, then try again.',
          );
          setTimeout(() => setState('idle'), 4000);
          return;
        }

        await alertsAPI.triggerPanic({
          userId,
          type: 'panic',
          nodeId: location.nodeId,
          nodeName: location.nodeName,
          floor: location.floor,
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          locationSource: location.locationSource,
          message:
            via === 'hold'
              ? 'Emergency alert (hold-to-send)'
              : 'Emergency alert — immediate help needed',
        });

        setState('sent');
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setTimeout(() => setState('idle'), 6000);
      } catch (err) {
        console.error('SOS Error:', err);
        setState('error');
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        Alert.alert(
          'Could not send alert',
          'Check your internet connection and try again.',
        );
        setTimeout(() => setState('idle'), 4000);
      }
    },
    [userId, selectedNodeId, graphData],
  );

  const confirmAndSend = useCallback(() => {
    if (state !== 'idle' && state !== 'error') return;

    Alert.alert(
      'Send emergency alert?',
      'Station staff will be notified immediately with your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => sendSOS('tap'),
        },
      ],
    );
  }, [state, sendSOS]);

  const handlePressIn = useCallback(() => {
    if (state !== 'idle' && state !== 'error') return;
    longPressTriggered.current = false;
    startHoldProgress();
  }, [state, startHoldProgress]);

  const handlePressOut = useCallback(() => {
    if (!longPressTriggered.current) {
      resetProgress();
    }
  }, [resetProgress]);

  const handleLongPress = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;
    longPressTriggered.current = true;
    resetProgress();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await sendSOS('hold');
  }, [state, sendSOS, resetProgress]);

  const isSent = state === 'sent';
  const isError = state === 'error';
  const busy = state === 'sending';

  const btnColor = isSent
    ? colors.crowdLow
    : isError
      ? colors.accentSaffron
      : colors.crowdHigh;
  const btnLabel = isSent
    ? '✅ Alert Sent!'
    : isError
      ? '⚠️ Retry'
      : '🚨 EMERGENCY';
  const btnSubtxt = isSent
    ? 'Station staff have been notified'
    : isError
      ? 'Could not send — tap to retry'
      : 'Tap to confirm · or hold 2 seconds to send instantly';

  const pressProgress = pressAnimValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const selectedNode =
    selectedNodeId && graphData?.nodes?.[selectedNodeId]
      ? graphData.nodes[selectedNodeId]
      : null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: isSent ? 1 : pulse }] }}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: `${btnColor}18`, borderColor: btnColor },
            pressed && !busy && !isSent && { opacity: 0.9 },
          ]}
          onPress={confirmAndSend}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          delayLongPress={LONG_PRESS_MS}
          disabled={busy || isSent}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: `${btnColor}30`,
                width: pressProgress,
              },
            ]}
          />
          {busy ? (
            <ActivityIndicator size="large" color={btnColor} />
          ) : (
            <Text style={[styles.btnLabel, { color: btnColor }]}>
              {btnLabel}
            </Text>
          )}
        </Pressable>
      </Animated.View>
      <Text style={styles.subText}>{btnSubtxt}</Text>

      {selectedNode ? (
        <Text style={styles.locationText}>📍 {selectedNode.name}</Text>
      ) : (
        <Text style={styles.locationHint}>
          No landmark selected — your GPS coordinates will be sent to staff
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  btn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    height: '100%',
    left: 0,
    bottom: 0,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    zIndex: 1,
  },
  subText: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  locationText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  locationHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    fontStyle: 'italic',
  },
});
