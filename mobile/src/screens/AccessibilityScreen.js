import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { colors, spacing, radius } from '../theme';

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
  const toggle = (key) => updateSettings({ [key]: !settings[key] });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>♿ Accessibility Settings</Text>
      <Text style={styles.subtitle}>Customize navigation and display for your needs.</Text>

      {/* Navigation Mode */}
      <Text style={styles.sectionTitle}>🚶 Navigation Mode</Text>
      <View style={styles.modeGrid}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.modeCard, settings.mode === m.id && styles.modeCardActive]}
            onPress={() => updateSettings({
              mode: m.id,
              avoidStairs: m.id !== 'none',
              preferLift: m.id === 'wheelchair' || m.id === 'elderly',
            })}
            activeOpacity={0.8}
          >
            <Text style={styles.modeIcon}>{m.icon}</Text>
            <Text style={[styles.modeLabel, settings.mode === m.id && styles.modeLabelActive]}>{m.label}</Text>
            <Text style={styles.modeDesc}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Routing Preferences */}
      <Text style={styles.sectionTitle}>🗺️ Routing Preferences</Text>
      <View style={styles.card}>
        {ROUTING_PREFS.map((pref, i) => (
          <View key={pref.key} style={[styles.prefRow, i < ROUTING_PREFS.length - 1 && styles.prefRowBorder]}>
            <Text style={styles.prefIcon}>{pref.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefLabel}>{pref.label}</Text>
              <Text style={styles.prefDesc}>{pref.desc}</Text>
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
      <Text style={styles.sectionTitle}>🖥️ Display Settings</Text>
      <View style={styles.card}>
        {DISPLAY_PREFS.map((pref, i) => (
          <View key={pref.key} style={[styles.prefRow, i < DISPLAY_PREFS.length - 1 && styles.prefRowBorder]}>
            <Text style={styles.prefIcon}>{pref.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefLabel}>{pref.label}</Text>
              <Text style={styles.prefDesc}>{pref.desc}</Text>
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
        <View style={styles.activeNotice}>
          <Text style={styles.activeNoticeText}>
            ♿ <Text style={{ fontWeight: '700' }}>Accessibility routing active:</Text> Navigation will automatically avoid stairs and prefer accessible routes.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgPrimary },
  content:  { padding: spacing.md, paddingBottom: spacing.xl },
  title:    { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },

  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  modeCard: {
    width: '47.5%', backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 2, borderColor: colors.border,
  },
  modeCardActive: { borderColor: colors.accentBlue, backgroundColor: 'rgba(59,130,246,0.1)' },
  modeIcon:       { fontSize: 24, marginBottom: 6 },
  modeLabel:      { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  modeLabelActive:{ color: colors.accentBlue },
  modeDesc:       { fontSize: 11, color: colors.textMuted, lineHeight: 15 },

  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  prefIcon:  { fontSize: 22 },
  prefLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  prefDesc:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  activeNotice: { backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', padding: spacing.md },
  activeNoticeText: { fontSize: 14, color: colors.accentBlue, lineHeight: 20 },
});
