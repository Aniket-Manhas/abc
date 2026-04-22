import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { geoAPI, alertsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PanicButton from '../components/PanicButton';
import { colors, spacing, radius } from '../theme';

const EMERGENCY_CONTACTS = [
  { label: 'Control Room',        number: '139', icon: '🚨' },
  { label: 'Medical Emergency',   number: '112', icon: '🏥' },
  { label: 'Railway Police (RPF)',number: '182', icon: '👮' },
  { label: 'Fire / Civil Defence',number: '101', icon: '🔥' },
];

const SAFETY_TIPS = [
  'Stay calm and stay where you are after pressing emergency',
  'Move towards gates if you smell smoke or gas',
  'Use lifts/ramps in case of injury, avoid stairs',
  'Follow instructions from uniformed staff',
  'Do not block emergency corridors',
];

const STATUS_ICON  = { active: '🔴', acknowledged: '🟡', resolved: '✅' };
const STATUS_COLOR = { active: colors.crowdHigh, acknowledged: colors.crowdMedium, resolved: colors.crowdLow };

export default function EmergencyScreen() {
  const { user } = useAuth();
  const [graphData, setGraphData] = useState(null);
  const [currentNode, setCurrentNode] = useState('');
  const [myAlerts, setMyAlerts]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([geoAPI.getGraph(), alertsAPI.getMy()])
      .then(([graph, alerts]) => {
        setGraphData(graph.data);
        setMyAlerts(alerts.data || []);
        const firstNode = Object.keys(graph.data?.nodes || {})[0];
        if (firstNode) setCurrentNode(firstNode);
      })
      .catch(_ => {})
      .finally(() => setLoading(false));
  }, []);

  const nodes = graphData
    ? Object.values(graphData.nodes || {}).filter(n => n.type !== 'boundary')
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.crowdHigh} />
        <Text style={styles.loadingText}>Loading emergency system…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency & Safety</Text>
        <Text style={styles.subtitle}>Tap the emergency button to immediately alert station staff.</Text>
      </View>

      {/* Location picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Your Current Location</Text>
        <View style={styles.pickerBox} collapsable={false}>
          <Picker
            selectedValue={currentNode}
            onValueChange={setCurrentNode}
            style={styles.picker}
            mode="dropdown"
            dropdownIconColor={colors.textMuted}
          >
            {nodes.map(n => (
              <Picker.Item key={n.id} label={n.name} value={n.id} />
            ))}
          </Picker>
        </View>
        <Text style={styles.pickerHint}>Select your nearest landmark</Text>
      </View>

      {/* Panic button */}
      <PanicButton currentNodeId={currentNode} graphData={graphData} userId={user?._id} />

      {/* Emergency contacts */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📞 Station Helpline</Text>
        {EMERGENCY_CONTACTS.map(c => (
          <TouchableOpacity
            key={c.label}
            style={styles.contactRow}
            onPress={() => Linking.openURL(`tel:${c.number}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.contactIcon}>{c.icon}</Text>
            <Text style={styles.contactLabel}>{c.label}</Text>
            <Text style={styles.contactNumber}>{c.number} ↗</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Safety tips */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛡️ Safety Tips</Text>
        {SAFETY_TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Alert history */}
      {myAlerts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 My Alert History</Text>
          {myAlerts.map(alert => (
            <View key={alert._id} style={[styles.alertRow, { borderLeftColor: STATUS_COLOR[alert.status] }]}>
              <Text style={{ fontSize: 20 }}>{STATUS_ICON[alert.status]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertType}>{alert.type?.toUpperCase()} — {alert.location?.nodeName}</Text>
                <Text style={styles.alertTime}>{new Date(alert.createdAt).toLocaleString()}</Text>
              </View>
              <Text style={[styles.alertStatus, { color: STATUS_COLOR[alert.status] }]}>{alert.status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center:  { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted },

  header:    { marginBottom: spacing.md },
  title:     { fontSize: 22, fontWeight: '800', color: colors.crowdHigh },
  subtitle:  { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },

  pickerBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 4,
    height: 50,
    justifyContent: 'center',
  },
  picker: { color: colors.textPrimary, height: 50 },
  pickerHint:{ fontSize: 11, color: colors.textMuted },

  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  contactIcon:  { fontSize: 18, marginRight: spacing.sm },
  contactLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  contactNumber:{ fontSize: 16, fontWeight: '700', color: colors.accentBlue },

  tipRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  tipBullet:{ color: colors.accentSaffron, fontSize: 16, marginTop: 1 },
  tipText:  { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

  alertRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8, paddingLeft: 8, borderLeftWidth: 3 },
  alertType:      { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  alertTime:      { fontSize: 11, color: colors.textMuted },
  alertStatus:    { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
