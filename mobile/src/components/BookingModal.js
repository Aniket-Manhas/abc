import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { colors, spacing, radius } from '../theme';

const STEPS = ['form', 'confirm', 'done'];

function genRef() {
  return 'SAH-' + Math.random().toString(36).toUpperCase().slice(2, 8);
}

export default function BookingModal({ vehicle: v, onClose }) {
  const [step, setStep]     = useState('form');
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [ref, setRef]       = useState('');

  const proceed = async () => {
    if (step === 'form') {
      if (!name.trim() || !phone.trim()) return;
      setStep('confirm');
    } else if (step === 'confirm') {
      setLoading(true);
      await new Promise(r => setTimeout(r, 1200));
      setRef(genRef());
      setStep('done');
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.vehicleIcon}>{v.emoji}</Text>
            <View style={styles.headerText}>
              <Text style={styles.vehicleName}>{v.name}</Text>
              <Text style={styles.vehicleProvider}>{v.provider}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Progress */}
            <View style={styles.progressRow}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.progressItem}>
                  <View style={[styles.progressDot, STEPS.indexOf(step) >= i && styles.progressDotActive]}>
                    <Text style={styles.progressDotText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.progressLabel, STEPS.indexOf(step) >= i && styles.progressLabelActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Step: form */}
            {step === 'form' && (
              <View style={styles.stepContent}>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Fare</Text>
                  <Text style={styles.fareValue}>{v.fare}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>ETA</Text>
                  <Text style={styles.fareValue}>{v.eta}</Text>
                </View>

                <Text style={styles.fieldLabel}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Rahul Sharma"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Step: confirm */}
            {step === 'confirm' && (
              <View style={styles.stepContent}>
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>Booking Summary</Text>
                  {[
                    { l: 'Transport', v: v.name },
                    { l: 'Fare', v: v.fare },
                    { l: 'Passenger', v: name },
                    { l: 'Phone', v: phone },
                    { l: 'Pickup', v: 'Jammu Tawi Station — Main Exit' },
                  ].map(r => (
                    <View key={r.l} style={styles.confirmRow}>
                      <Text style={styles.confirmLabel}>{r.l}</Text>
                      <Text style={styles.confirmValue}>{r.v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Step: done */}
            {step === 'done' && (
              <View style={styles.stepContent}>
                <View style={styles.doneBox}>
                  <Text style={styles.doneIcon}>✅</Text>
                  <Text style={styles.doneTitle}>Booking Confirmed!</Text>
                  <Text style={styles.doneRef}>Booking ID: <Text style={styles.doneRefVal}>{ref}</Text></Text>
                  <Text style={styles.doneSub}>Present this ID at the {v.name} counter or to the driver.</Text>
                  <View style={styles.doneInfo}>
                    <Text style={styles.doneInfoText}>📍 Head to <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Main exit, Gate 1</Text></Text>
                    <Text style={styles.doneInfoText}>⏱ ETA: {v.eta}</Text>
                  </View>
                </View>
                {v.appLink && (
                  <TouchableOpacity style={styles.appLinkBtn} onPress={() => Linking.openURL(v.appLink)}>
                    <Text style={styles.appLinkText}>📱 Also open {v.name} App ↗</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {step !== 'done' ? (
              <TouchableOpacity
                style={[styles.proceedBtn, loading && styles.btnDisabled]}
                onPress={proceed}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.proceedText}>{step === 'form' ? 'Next →' : '✅ Confirm Booking'}</Text>
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeFullBtn} onPress={onClose}>
                <Text style={styles.proceedText}>🏠 Back to Last Mile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: 24 },
  handle:  { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },

  header:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  vehicleIcon:    { fontSize: 28 },
  headerText:     { flex: 1 },
  vehicleName:    { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  vehicleProvider:{ fontSize: 12, color: colors.textMuted },
  closeBtn: { fontSize: 16, color: colors.textMuted },

  progressRow:      { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.md },
  progressItem:     { alignItems: 'center', gap: 4 },
  progressDot:      { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  progressDotActive:{ backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  progressDotText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressLabel:    { fontSize: 11, color: colors.textMuted },
  progressLabelActive:{ color: colors.accentBlue, fontWeight: '600' },

  stepContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  fareRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  fareLabel:  { color: colors.textMuted, fontSize: 13 },
  fareValue:  { color: colors.accentSaffron, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: 10,
  },

  confirmBox:   { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  confirmTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  confirmRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  confirmLabel: { color: colors.textMuted, fontSize: 13 },
  confirmValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  doneBox:   { alignItems: 'center', paddingVertical: spacing.lg },
  doneIcon:  { fontSize: 48, marginBottom: spacing.sm },
  doneTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  doneRef:   { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  doneRefVal:{ color: colors.accentSaffron, fontWeight: '800', fontFamily: 'monospace' },
  doneSub:   { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  doneInfo:  { gap: spacing.xs, alignItems: 'center' },
  doneInfoText:{ fontSize: 13, color: colors.textSecondary },
  appLinkBtn:{ backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  appLinkText:{ color: colors.accentBlue, fontWeight: '600', fontSize: 14 },

  footer:      { padding: spacing.md, paddingTop: 8 },
  proceedBtn:  { backgroundColor: colors.accentBlue, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  closeFullBtn:{ backgroundColor: colors.bgElevated, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  btnDisabled: { opacity: 0.6 },
  proceedText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
