import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { spacing, radius } from '../theme';
import useTheme from '../useTheme';

const MODES = [
  { id: 'none',              label: 'Standard Mode',       icon: '🚶', desc: 'No special routing constraints' },
  { id: 'wheelchair',        label: 'Wheelchair User',     icon: '♿', desc: 'Avoids stairs, prefers lifts and ramps' },
  { id: 'elderly',           label: 'Elderly / Slow Walk', icon: '🧓', desc: 'Avoids stairs, prefers shorter routes' },
  { id: 'visually_impaired', label: 'Visually Impaired',   icon: '🦯', desc: 'Simplified directions' },
];

const ROUTING_PREFS = [
  { key: 'avoidStairs', label: 'Avoid Stairs', icon: '🪜', desc: 'Route will use lifts or ramps instead' },
  { key: 'preferLift',  label: 'Prefer Lifts', icon: '🛗', desc: 'Prioritize lift routes over ramps' },
];

const DISPLAY_PREFS = [
  { key: 'highContrast', label: 'High Contrast Mode', icon: '🔆', desc: 'Increases visual contrast' },
  { key: 'largeText',    label: 'Large Text Mode',     icon: '🔡', desc: 'Increases font size throughout the app' },
];

export default function AccessibilityScreen() {
  const { settings, updateSettings, isAccessible } = useAccessibility();
  const { colors, fs } = useTheme();
  const toggle = (key) => updateSettings({ [key]: !settings[key] });

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontSize: fs(22), color: colors.textPrimary }]}>♿ Accessibility Settings</Text>
      <Text style={[styles.subtitle, { fontSize: fs(14), color: colors.textSecondary }]}>Customize navigation and display for your needs.</Text>

      {/* Navigation Mode */}
      <Text style={[styles.sectionTitle, { fontSize: fs(13), color: colors.textSecondary }]}>🚶 Navigation Mode</Text>
      <View style={styles.modeGrid}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.modeCard,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              settings.mode === m.id && { borderColor: colors.accentBlue, backgroundColor: 'rgba(59,130,246,0.1)' }
            ]}
            onPress={() => updateSettings({
              mode: m.id,
              avoidStairs: m.id !== 'none',
              preferLift: m.id === 'wheelchair' || m.id === 'elderly',
            })}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeIcon, { fontSize: fs(24) }]}>{m.icon}</Text>
            <Text style={[styles.modeLabel, { fontSize: fs(13), color: settings.mode === m.id ? colors.accentBlue : colors.textPrimary }]}>{m.label}</Text>
            <Text style={[styles.modeDesc, { fontSize: fs(11), color: colors.textMuted }]}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Routing Preferences */}
      <Text style={[styles.sectionTitle, { fontSize: fs(13), color: colors.textSecondary }]}>🗺️ Routing Preferences</Text>
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {ROUTING_PREFS.map((pref, i) => (
          <View key={pref.key} style={[styles.prefRow, i < ROUTING_PREFS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={styles.prefIcon}>{pref.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefLabel, { fontSize: fs(14), color: colors.textPrimary }]}>{pref.label}</Text>
              <Text style={[styles.prefDesc, { fontSize: fs(12), color: colors.textMuted }]}>{pref.desc}</Text>
            </View>
            <Switch
              value={settings[pref.key]}
              onValueChange={() => toggle(pref.key)}
              trackColor={{ false: colors.bgElevated, true: colors.accentBlue + '80' }}
              thumbColor={settings[pref.key] ? colors.accentBlue : colors.textMuted}
            />
          </View>
        ))}
      </View>

      {/* Display Settings */}
      <Text style={[styles.sectionTitle, { fontSize: fs(13), color: colors.textSecondary }]}>🖥️ Display Settings</Text>
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {DISPLAY_PREFS.map((pref, i) => (
          <View key={pref.key} style={[styles.prefRow, i < DISPLAY_PREFS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={styles.prefIcon}>{pref.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefLabel, { fontSize: fs(14), color: colors.textPrimary }]}>{pref.label}</Text>
              <Text style={[styles.prefDesc, { fontSize: fs(12), color: colors.textMuted }]}>{pref.desc}</Text>
            </View>
            <Switch
              value={settings[pref.key]}
              onValueChange={() => toggle(pref.key)}
              trackColor={{ false: colors.bgElevated, true: colors.accentBlue + '80' }}
              thumbColor={settings[pref.key] ? colors.accentBlue : colors.textMuted}
            />
          </View>
        ))}
      </View>

      {isAccessible && (
        <View style={[styles.activeNotice, { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.25)' }]}>
          <Text style={[styles.activeNoticeText, { color: colors.accentBlue }]}>
            ♿ <Text style={{ fontWeight: '700' }}>Accessibility routing active:</Text> Navigation will automatically avoid stairs and prefer accessible routes.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  content:  { padding: spacing.md, paddingBottom: spacing.xl },
  title:    { fontWeight: '800', marginBottom: 4 },
  subtitle: { marginBottom: spacing.lg },

  sectionTitle: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },

  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  modeCard: {
    width: '47.5%', borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 2,
  },
  modeCardActive: { },
  modeIcon:       { marginBottom: 6 },
  modeLabel:      { fontWeight: '700', marginBottom: 3 },
  modeLabelActive:{ },
  modeDesc:       { lineHeight: 15 },

  card: { borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg, overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  prefRowBorder: { borderBottomWidth: 1 },
  prefIcon:  { fontSize: 22 },
  prefLabel: { fontWeight: '600' },
  prefDesc:  { marginTop: 2 },

  activeNotice: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  activeNoticeText: { fontSize: 14, lineHeight: 20 },
});

