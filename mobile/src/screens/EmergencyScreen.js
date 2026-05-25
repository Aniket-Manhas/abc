import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { geoAPI, alertsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PanicButton from '../components/PanicButton';
import { PLACEHOLDER_VALUE } from '../utils/emergencyLocation';
import { colors, spacing, radius } from '../theme';
import useTheme from '../useTheme';

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

const STATUS_ICON = { active: '🔴', acknowledged: '🟡', resolved: '✅' };

function formatAlertLocation(alert) {
  const loc = alert?.location;
  if (!loc) return 'Unknown';
  const parts = [loc.nodeName];
  if (loc.floor != null && loc.floor !== undefined) {
    parts.push(`Floor ${loc.floor}`);
  }
  if (loc.lat != null && loc.lng != null) {
    parts.push(`${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
  }
  return parts.filter(Boolean).join(' · ');
}

export default function EmergencyScreen() {
  const { user } = useAuth();
  const { colors, fs } = useTheme();
  const [graphData, setGraphData] = useState(null);
  const [currentNode, setCurrentNode] = useState(PLACEHOLDER_VALUE);
  const [myAlerts, setMyAlerts]   = useState([]);
  const [loading, setLoading]     = useState(true);

  const STATUS_COLOR = { active: colors.crowdHigh, acknowledged: colors.crowdMedium, resolved: colors.crowdLow };

  useEffect(() => {
    Promise.all([geoAPI.getGraph(), alertsAPI.getMy()])
      .then(([graph, alerts]) => {
        setGraphData(graph.data);
        setMyAlerts(alerts.data || []);
      })
      .catch(_ => {})
      .finally(() => setLoading(false));
  }, []);

  const nodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    return Object.values(graphData.nodes)
      .filter(n => n.type !== 'boundary')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [graphData]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.crowdHigh} />
        <Text style={{ color: colors.textMuted, fontSize: fs(14) }}>Loading emergency system…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bgPrimary }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={{ fontSize: fs(22), fontWeight: '800', color: colors.crowdHigh }}>🚨 Emergency & Safety</Text>
        <Text style={{ fontSize: fs(14), color: colors.textSecondary, marginTop: 4 }}>
          Tap the emergency button to alert station staff. Your GPS is always included when available.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={{ fontSize: fs(15), fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>
          📍 Where are you? (optional)
        </Text>
        <View style={[styles.pickerBox, { backgroundColor: colors.bgElevated, borderColor: colors.border }]} collapsable={false}>
          <Picker
            selectedValue={currentNode}
            onValueChange={setCurrentNode}
            style={[styles.picker, { color: colors.textPrimary }]}
            mode="dropdown"
            dropdownIconColor={colors.textMuted}
          >
            <Picker.Item
              label="— Select nearest landmark (optional) —"
              value={PLACEHOLDER_VALUE}
            />
            {nodes.map(n => (
              <Picker.Item key={n.id} label={n.name} value={n.id} />
            ))}
          </Picker>
        </View>
        <Text style={{ fontSize: fs(11), color: colors.textMuted, marginTop: 4 }}>
          Leave unselected to send only your live GPS to admins. Select a landmark if you know your area.
        </Text>
      </View>

      <PanicButton
        selectedNodeId={currentNode}
        graphData={graphData}
        userId={user?._id}
      />

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={{ fontSize: fs(15), fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>📞 Station Helpline</Text>
        {EMERGENCY_CONTACTS.map(c => (
          <TouchableOpacity
            key={c.label}
            style={[styles.contactRow, { borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL(`tel:${c.number}`)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: fs(18), marginRight: spacing.sm }}>{c.icon}</Text>
            <Text style={{ flex: 1, fontSize: fs(14), color: colors.textSecondary }}>{c.label}</Text>
            <Text style={{ fontSize: fs(16), fontWeight: '700', color: colors.accentBlue }}>{c.number} ↗</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={{ fontSize: fs(15), fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>🛡️ Safety Tips</Text>
        {SAFETY_TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={{ color: colors.accentSaffron, fontSize: fs(16), marginTop: 1 }}>•</Text>
            <Text style={{ flex: 1, color: colors.textSecondary, fontSize: fs(13), lineHeight: fs(13) * 1.5 }}>{tip}</Text>
          </View>
        ))}
      </View>

      {myAlerts.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={{ fontSize: fs(15), fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>📋 My Alert History</Text>
          {myAlerts.map(alert => (
            <View key={alert._id} style={[styles.alertRow, { borderLeftColor: STATUS_COLOR[alert.status] }]}>
              <Text style={{ fontSize: fs(20) }}>{STATUS_ICON[alert.status]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.textPrimary }}>
                  {alert.type?.toUpperCase()} — {formatAlertLocation(alert)}
                </Text>
                <Text style={{ fontSize: fs(11), color: colors.textMuted }}>{new Date(alert.createdAt).toLocaleString()}</Text>
              </View>
              <Text style={{ fontSize: fs(12), fontWeight: '700', color: STATUS_COLOR[alert.status], textTransform: 'capitalize' }}>{alert.status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  header:  { marginBottom: spacing.md },
  card: {
    borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1,
  },
  pickerBox: {
    borderRadius: radius.md, borderWidth: 1, overflow: 'hidden',
    marginBottom: 4, height: 50, justifyContent: 'center',
  },
  picker: { height: 50 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  tipRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  alertRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8, paddingLeft: 8, borderLeftWidth: 3 },
});
