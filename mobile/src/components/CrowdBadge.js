import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const MAP = {
  high:   { label: 'Busy',  color: colors.crowdHigh,   bg: 'rgba(231,76,60,0.12)',  icon: '🔴' },
  medium: { label: 'Moderate', color: colors.crowdMedium, bg: 'rgba(230,126,34,0.12)', icon: '🟡' },
  low:    { label: 'Clear', color: colors.crowdLow,    bg: 'rgba(39,174,96,0.12)',  icon: '🟢' },
};

export default function CrowdBadge({ density }) {
  const cfg = MAP[density] || MAP.low;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
      <Text style={{ fontSize: 10 }}>{cfg.icon}</Text>
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '700' },
});
