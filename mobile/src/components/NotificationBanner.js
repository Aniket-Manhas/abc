import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { colors, radius, spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationBanner() {
  const { notifications, dismissNotification } = useSocket();

  if (!notifications || notifications.length === 0) return null;
  const notif = notifications[0];

  const getBgColor = () => {
    if (notif.type === 'danger' || notif.type === 'critical') return colors.crowdHigh;
    if (notif.type === 'warning') return colors.crowdMedium;
    return colors.bgElevated;
  };

  return (
    <View style={[styles.banner, { backgroundColor: getBgColor() }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="notifications" size={18} color={colors.textPrimary} />
          <Text style={styles.title} numberOfLines={1}>{notif.title}</Text>
        </View>
        <Text style={styles.message}>{notif.message}</Text>
      </View>
      <TouchableOpacity onPress={() => dismissNotification(0)} style={styles.closeBtn}>
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, flex: 1 },
  message: { fontSize: 14, color: colors.textPrimary, opacity: 0.9 },
  closeBtn: { padding: 8 }
});
