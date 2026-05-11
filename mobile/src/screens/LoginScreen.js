import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius } from '../theme';
import useTheme from '../useTheme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp]           = useState('');
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login, verifyOtp } = useAuth();
  const { colors, fs } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigator auto-redirects on user state change
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.unverified) {
        setIsOtpMode(true);
        Alert.alert('Email not verified', 'An OTP has been sent to your email.');
      } else {
        Alert.alert(
          'Login failed',
          err.response?.data?.message || 'Check your credentials and try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Missing field', 'Please enter the OTP.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
    } catch (err) {
      Alert.alert('Verification failed', err.response?.data?.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoIcon}>🚂</Text>
          <Text style={[styles.logoText, { color: colors.accentSaffron, fontSize: fs(32) }]}>Sahyatri</Text>
          <Text style={[styles.logoSub, { color: colors.textMuted, fontSize: fs(13) }]}>Smart Indoor Railway Navigation</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary, fontSize: fs(18) }]}>Passenger Login</Text>

          {!isOtpMode ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.textOnAccent} />
                  : <Text style={styles.btnText}>🚀 Sign In</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Enter 6-digit OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.textOnAccent} />
                  : <Text style={styles.btnText}>✅ Verify OTP</Text>
                }
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => setIsOtpMode(false)}
              >
                <Text style={styles.linkText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>New passenger? <Text style={styles.link}>Create account</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Demo hint */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo credentials</Text>
          <Text style={styles.demoText}>User: Register a new account</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.bgPrimary },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },

  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logoIcon: { fontSize: 56, marginBottom: spacing.sm },
  logoText: { fontSize: 32, fontWeight: '800', color: colors.accentSaffron, letterSpacing: 1 },
  logoSub:  { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },

  inputGroup: { marginBottom: spacing.md },
  label:      { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  linkRow: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  link:     { color: colors.accentBlue, fontWeight: '600' },

  demoBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  demoText:  { color: colors.textSecondary, fontSize: 12 },
});
