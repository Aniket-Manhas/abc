import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { alertsAPI } from '../services/api';
import { colors, spacing, radius } from '../theme';

export default function PanicButton({ currentNodeId, graphData, userId }) {
  const [state, setState] = React.useState('idle'); // idle | pressing | sending | sent | error
  const pulse  = useRef(new Animated.Value(1)).current;
  const anim   = useRef(null);

  useEffect(() => {
    anim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.current.start();
    return () => anim.current?.stop();
  }, []);

  const handlePress = async () => {
    if (state !== 'idle' && state !== 'error') return;
    setState('pressing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const nodeData = graphData?.nodes?.[currentNodeId];
    setState('sending');
    try {
      let lat = null, lng = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (e) { console.warn("GPS failed in panic", e); }

      await alertsAPI.triggerPanic({
        userId,
        type: 'panic',
        nodeId: currentNodeId || 'unknown',
        nodeName: nodeData?.name || 'Unknown',
        floor: nodeData?.floor ?? 0,
        lat,
        lng,
      });
      setState('sent');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reset after 6s
      setTimeout(() => setState('idle'), 6000);
    } catch (_) {
      setState('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const isSent  = state === 'sent';
  const isError = state === 'error';
  const busy    = state === 'sending' || state === 'pressing';

  const btnColor  = isSent ? colors.crowdLow : isError ? colors.accentSaffron : colors.crowdHigh;
  const btnLabel  = isSent ? '✅ Alert Sent!' : isError ? '⚠️ Retry' : '🚨 EMERGENCY';
  const btnSubtxt = isSent
    ? 'Station staff have been notified'
    : isError
    ? 'Could not send — check connection'
    : 'Press to alert station staff immediately';

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: isSent ? 1 : pulse }] }}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: `${btnColor}18`, borderColor: btnColor }]}
          onPress={handlePress}
          disabled={busy || isSent}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="large" color={btnColor} />
          ) : (
            <Text style={[styles.btnLabel, { color: btnColor }]}>{btnLabel}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.subText}>{btnSubtxt}</Text>

      {currentNodeId && graphData?.nodes?.[currentNodeId] && (
        <Text style={styles.locationText}>
          📍 {graphData.nodes[currentNodeId].name}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { alignItems: 'center', marginVertical: spacing.lg },
  btn: {
    width: 180, height: 180, borderRadius: 90,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3,
  },
  btnLabel:   { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  subText:    { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  locationText:{ color: colors.textSecondary, fontSize: 12, marginTop: 4 },
});
