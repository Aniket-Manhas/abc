import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, useWindowDimensions, Modal, FlatList,
  RefreshControl, Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { geoAPI } from '../services/api';
import { colors, spacing, radius } from '../theme';
import useTheme from '../useTheme';
import { Ionicons } from '@expo/vector-icons';

const QUICK_ACCESS = [
  { icon: '🧭', labelKey: 'indoor_nav',     screen: 'Navigate',      bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
  { icon: '🚨', labelKey: 'emergency_help', screen: 'Emergency',     bg: 'rgba(231,76,60,0.1)',   border: 'rgba(231,76,60,0.3)'   },
  { icon: '♿', labelKey: 'accessibility',  screen: 'Accessibility', bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.3)', parent: 'More' },
  { icon: '🚕', labelKey: 'last_mile',      screen: 'LastMile',      bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)', parent: 'More' },
];

const TYPE_COLORS = {
  danger:    '#ef4444',
  emergency: '#ef4444',
  critical:  '#ef4444',
  warning:   '#f59e0b',
  info:      '#3b82f6',
  congestion:'#f97316',
  route_change: '#a855f7',
};

const TYPE_ICONS = {
  danger: '🚨', emergency: '🚨', critical: '⛔',
  warning: '⚠️', info: 'ℹ️', congestion: '🔴', route_change: '🔄',
};

function StatCard({ icon, label, value, color, bg }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg, borderColor: `${color}40` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NotificationModal({ visible, notifications, onDismiss, onDismissAll, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔔 Notifications</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={onDismissAll} style={styles.clearAllBtn}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyNotif}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔕</Text>
              <Text style={styles.emptyNotifText}>No notifications yet</Text>
              <Text style={styles.emptyNotifSub}>Alerts from admins will appear here.</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
              renderItem={({ item, index }) => {
                const col = TYPE_COLORS[item.type] || colors.accentBlue;
                const ico = TYPE_ICONS[item.type] || 'ℹ️';
                return (
                  <View style={[styles.notifItem, { borderLeftColor: col }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>{ico}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, { color: col }]}>{item.title}</Text>
                        <Text style={styles.notifMessage}>{item.message}</Text>
                        {item.createdAt && (
                          <Text style={styles.notifTime}>
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => onDismiss(index)} style={{ padding: 4 }}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { crowdData, connected, notifications, dismissNotification, setNotifications } = useSocket();
  const { colors, fs } = useTheme();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [booting, setBooting]     = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const loadData = useCallback(() => {
    return geoAPI.getGraph()
      .then(r => setGraphData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const crowdSummary = graphData ? (() => {
    const counts = { low: 0, medium: 0, high: 0 };
    Object.values(crowdData).forEach(v => {
      const d = typeof v === 'string' ? v : v?.density;
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  })() : null;

  const firstName = user?.name?.split(' ')[0] || t('passenger');
  const unreadCount = notifications?.length || 0;

  const handleDismissAll = () => {
    if (setNotifications) setNotifications([]);
  };

  const connectionColor = connected ? '#22c55e' : booting ? colors.accentSaffron : '#6b7280';
  const connectionLabel = connected ? 'Live' : booting ? 'Connecting' : 'Offline';

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentSaffron} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>

          <View style={styles.headerActions}>
            {/* Language Toggle */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')}>
              <Text style={styles.iconBtnText}>{i18n.language === 'en' ? 'अ' : 'A'}</Text>
            </TouchableOpacity>

            {/* Notification Bell */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setNotifOpen(true)}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity style={[styles.iconBtn, styles.logoutBtn]} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={colors.crowdHigh} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Status Pill ── */}
        <View style={[styles.statusPill, { borderColor: `${connectionColor}40` }]}>
          <View style={[styles.statusDot, { backgroundColor: connectionColor }]} />
          <Text style={[styles.statusText, { color: connectionColor }]}>{connectionLabel}</Text>
        </View>

        {/* ── Emergency CTA ── */}
        <TouchableOpacity
          style={styles.emergencyBtn}
          onPress={() => navigation.navigate('Emergency')}
          activeOpacity={0.85}
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>Emergency Help</Text>
            <Text style={styles.emergencySub}>Tap to report an emergency immediately</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.crowdHigh} />
        </TouchableOpacity>

        {/* ── Crowd Summary ── */}
        {crowdSummary && (
          <>
            <Text style={styles.sectionTitle}>🏟️ Station Crowd</Text>
            <View style={styles.statRow}>
              <StatCard icon="🟢" label="Clear" value={crowdSummary.low}    color="#22c55e" bg="rgba(34,197,94,0.08)" />
              <StatCard icon="🟡" label="Medium" value={crowdSummary.medium} color="#f59e0b" bg="rgba(245,158,11,0.08)" />
              <StatCard icon="🔴" label="Busy"  value={crowdSummary.high}   color="#ef4444" bg="rgba(239,68,68,0.08)" />
            </View>
          </>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accentSaffron} size="small" />
            <Text style={styles.loadingText}>Loading station data…</Text>
          </View>
        )}

        {/* ── Quick Access ── */}
        <Text style={styles.sectionTitle}>⚡ Quick Access</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACCESS.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={[styles.quickCard, { backgroundColor: item.bg, borderColor: item.border }]}
              activeOpacity={0.8}
              onPress={() => {
                if (item.parent) navigation.navigate('More', { screen: item.screen });
                else navigation.navigate(item.screen);
              }}
            >
              <Text style={styles.quickIcon}>{item.icon}</Text>
              <Text style={styles.quickLabel}>{t(item.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Latest Notification Preview ── */}
        {notifications?.length > 0 && (
          <TouchableOpacity style={styles.notifPreview} onPress={() => setNotifOpen(true)} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifPreviewTitle}>
                {TYPE_ICONS[notifications[0].type] || 'ℹ️'} {notifications[0].title}
              </Text>
              <Text style={styles.notifPreviewMsg} numberOfLines={1}>{notifications[0].message}</Text>
            </View>
            <View style={styles.notifPreviewBadge}>
              <Text style={styles.notifPreviewBadgeText}>{unreadCount} new</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Station Info ── */}
        <View style={styles.stationInfo}>
          <Ionicons name="train-outline" size={14} color={colors.textMuted} />
          <Text style={styles.stationInfoText}> Sahyatri Smart Navigation System</Text>
        </View>
      </ScrollView>

      <NotificationModal
        visible={notifOpen}
        notifications={notifications || []}
        onDismiss={dismissNotification}
        onDismissAll={handleDismissAll}
        onClose={() => setNotifOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.md, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  greeting: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  name: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  iconBtnText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  logoutBtn: {
    width: 'auto', paddingHorizontal: 12, borderRadius: 20,
    flexDirection: 'row', gap: 4,
    borderColor: 'rgba(231,76,60,0.3)', backgroundColor: 'rgba(231,76,60,0.1)',
  },
  logoutText: { color: colors.crowdHigh, fontSize: 13, fontWeight: '700' },

  // Badge
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.crowdHigh,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Status
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: spacing.md,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Emergency
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.35)',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  emergencyIcon: { fontSize: 28 },
  emergencyTitle: { color: colors.crowdHigh, fontSize: 16, fontWeight: '800' },
  emergencySub: { color: 'rgba(231,76,60,0.7)', fontSize: 12, marginTop: 2 },

  // Section
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // Stat Cards
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1 },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13 },

  // Quick Grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickCard: {
    width: '47.5%', borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.md, alignItems: 'center',
  },
  quickIcon: { fontSize: 30, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },

  // Notif Preview Banner
  notifPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  notifPreviewTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  notifPreviewMsg: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  notifPreviewBadge: {
    backgroundColor: colors.accentBlue, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  notifPreviewBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Station Info
  stationInfo: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, backgroundColor: colors.bgElevated,
    padding: spacing.sm + 2, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stationInfoText: { fontSize: 12, color: colors.textMuted },

  // ── Notification Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  clearAllBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  clearAllText: { color: colors.crowdHigh, fontSize: 12, fontWeight: '700' },
  closeBtn: { padding: 4 },
  emptyNotif: { alignItems: 'center', padding: 40 },
  emptyNotifText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  emptyNotifSub: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },

  notifItem: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, borderLeftWidth: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  notifMessage: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  notifTime: { fontSize: 11, color: colors.textMuted, marginTop: 5 },
});
