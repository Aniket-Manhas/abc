import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { alertsAPI } from "../services/api";
import { colors, spacing, radius } from "../theme";

const LONG_PRESS_DURATION = 2000; // 2 seconds in milliseconds

export default function PanicButton({ currentNodeId, graphData, userId }) {
  const [state, setState] = React.useState("idle"); // idle | pressing | holding | sending | sent | error
  const pulse = useRef(new Animated.Value(1)).current;
  const anim = useRef(null);
  const pressTimer = useRef(null);
  const pressStartTime = useRef(null);
  const pressAnimValue = useRef(new Animated.Value(0)).current;

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

  const handlePressIn = () => {
    if (state !== "idle" && state !== "error") return;

    setState("pressing");
    pressStartTime.current = Date.now();

    // Animate progress fill
    Animated.timing(pressAnimValue, {
      toValue: 0,
      duration: 0,
      useNativeDriver: false,
    }).start();

    pressTimer.current = setTimeout(async () => {
      // 2 seconds held - trigger SOS
      setState("holding");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Start animation to full
      Animated.timing(pressAnimValue, {
        toValue: 100,
        duration: 300,
        useNativeDriver: false,
      }).start();

      await sendSOS();
    }, LONG_PRESS_DURATION);
  };

  const handlePressOut = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    const elapsedTime = pressStartTime.current
      ? Date.now() - pressStartTime.current
      : 0;

    if (elapsedTime < LONG_PRESS_DURATION && state === "pressing") {
      // User released before 2 seconds
      setState("idle");
      // Light haptic feedback to indicate they didn't hold long enough
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Reset progress animation
      Animated.timing(pressAnimValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const sendSOS = async () => {
    const nodeData = graphData?.nodes?.[currentNodeId];
    setState("sending");
    try {
      let lat = null,
        lng = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (e) {
        console.warn("GPS failed in panic", e);
      }

      await alertsAPI.triggerPanic({
        userId,
        type: "panic",
        nodeId: currentNodeId || "unknown",
        nodeName: nodeData?.name || "Unknown",
        floor: nodeData?.floor ?? 0,
        lat,
        lng,
      });
      setState("sent");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reset after 6s
      setTimeout(() => setState("idle"), 6000);
    } catch (err) {
      console.error("SOS Error:", err);
      setState("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setState("idle"), 4000);
    }
  };

  const isSent = state === "sent";
  const isError = state === "error";
  const isPressing = state === "pressing";
  const isHolding = state === "holding";
  const busy = state === "sending" || state === "holding";

  const btnColor = isSent
    ? colors.crowdLow
    : isError
      ? colors.accentSaffron
      : colors.crowdHigh;
  const btnLabel = isSent
    ? "✅ Alert Sent!"
    : isError
      ? "⚠️ Retry"
      : "🚨 EMERGENCY";
  const btnSubtxt = isSent
    ? "Station staff have been notified"
    : isError
      ? "Could not send — check connection"
      : isPressing || isHolding
        ? "Hold for 2 seconds to trigger emergency alert"
        : "Press and hold power button for 2 seconds";

  const pressProgress = pressAnimValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: isSent ? 1 : pulse }] }}>
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: `${btnColor}18`, borderColor: btnColor },
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={busy || isSent}
          activeOpacity={0.85}
        >
          {/* Progress indicator */}
          {(isPressing || isHolding) && (
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: `${btnColor}30`,
                  width: pressProgress,
                },
              ]}
            />
          )}
          {busy ? (
            <ActivityIndicator size="large" color={btnColor} />
          ) : (
            <Text style={[styles.btnLabel, { color: btnColor }]}>
              {btnLabel}
            </Text>
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
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  btn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    height: "100%",
    left: 0,
    bottom: 0,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    zIndex: 1,
  },
  subText: {
    fontSize: 12,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
  },
  locationText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
});
