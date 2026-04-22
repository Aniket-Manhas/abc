import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { geoAPI } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

const QUICK_ACCESS = [
  { icon: '🧭', label: 'Indoor Navigation', screen: 'Navigate' },
  { icon: '🚨', label: 'Emergency Help',    screen: 'Emergency' },
  { icon: '♿', label: 'Accessibility',     screen: 'Accessibility', parent: 'More' },
  { icon: '🚕', label: 'Last Mile',         screen: 'LastMile',     parent: 'More' },
];

function StatCard({ icon, label, value, color, bg }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg, borderColor: `${color}30` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { crowdData, connected } = useSocket();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [booting, setBooting]     = useState(true); // first 3s grace period
  const { width } = useWindowDimensions();

  // Give socket 3 seconds to connect before showing "Offline"
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    geoAPI.getGraph()
      .then(r => setGraphData(r.data))
      .catch(_ => {})
      .finally(() => setLoading(false));
  }, []);

  const crowdSummary = graphData ? (() => {
    const counts = { low: 0, medium: 0, high: 0 };
    Object.values(crowdData).forEach(v => {
      const d = typeof v === 'string' ? v : v?.density;
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  })() : null;

  const firstName = user?.name?.split(' ')[0] || 'Passenger';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Welcome */}
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome, {firstName} 👋</Text>
          <Text style={styles.greetingSub}>Navigate Sahyatri Junction in real time</Text>
        </View>
        <View style={[styles.liveChip, {
            borderColor: connected ? colors.crowdLow + '50'
              : booting ? colors.accentSaffron + '50'
              : colors.border
          }]}>
          <View style={[styles.liveDot, {
            backgroundColor: connected ? colors.crowdLow
              : booting ? colors.accentSaffron
              : colors.textMuted
          }]} />
          <Text style={[styles.liveText, {
            color: connected ? colors.crowdLow
              : booting ? colors.accentSaffron
              : colors.textMuted
          }]}>
            {connected ? 'Live' : booting ? 'Connecting…' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Crowd summary */}
      {crowdSummary && (
        <>
          <Text style={styles.sectionTitle}>📊 Station Crowd</Text>
          <View style={styles.statRow}>
            <StatCard icon="🟢" label="Clear" value={crowdSummary.low}    color={colors.crowdLow}    bg="rgba(39,174,96,0.1)" />
            <StatCard icon="🟡" label="Medium" value={crowdSummary.medium} color={colors.crowdMedium} bg="rgba(230,126,34,0.1)" />
            <StatCard icon="🔴" label="Busy"  value={crowdSummary.high}   color={colors.crowdHigh}   bg="rgba(231,76,60,0.1)" />
          </View>
        </>
      )}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accentSaffron} />
          <Text style={styles.loadingText}>Loading station data…</Text>
        </View>
      )}

      {/* Emergency CTA */}
      <TouchableOpacity
        style={styles.emergencyBtn}
        onPress={() => navigation.navigate('Emergency')}
        activeOpacity={0.85}
      >
        <Text style={styles.emergencyBtnText}>🚨  Emergency Alert</Text>
      </TouchableOpacity>

      {/* Quick access */}
      <Text style={styles.sectionTitle}>⚡ Quick Access</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACCESS.map(item => (
          <TouchableOpacity
            key={item.screen}
            style={styles.quickCard}
            activeOpacity={0.8}
            onPress={() => {
              if (item.parent) {
                navigation.navigate('More', { screen: item.screen });
              } else {
                navigation.navigate(item.screen);
              }
            }}
          >
            <Text style={styles.quickIcon}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Station info */}
      <View style={styles.stationInfo}>
        <Text style={styles.stationInfoText}>🚉 Jammu Tawi Station · JAT · Northern Railway</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },

  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greeting:   { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  greetingSub:{ fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  liveChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:    { width: 7, height: 7, borderRadius: 4 },
  liveText:   { fontSize: 11, fontWeight: '700' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  statRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue:{ fontSize: 22, fontWeight: '800' },
  statLabel:{ fontSize: 11, color: colors.textMuted, marginTop: 2 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  loadingText:{ color: colors.textMuted, fontSize: 13 },

  emergencyBtn: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emergencyBtnText: { color: colors.crowdHigh, fontSize: 16, fontWeight: '800' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickCard: {
    width: '47.5%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickIcon:  { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },

  stationInfo: {
    borderRadius: radius.md, backgroundColor: colors.bgElevated,
    padding: spacing.sm + 2, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stationInfoText: { fontSize: 12, color: colors.textMuted },
});
