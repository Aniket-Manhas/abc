import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius } from '../theme';

const FIELDS = [
  { key: 'name',     label: 'Full Name',        placeholder: 'Rahul Sharma',    type: 'default',       required: true },
  { key: 'email',    label: 'Email',             placeholder: 'you@example.com', type: 'email-address', required: true },
  { key: 'phone',    label: 'Phone (optional)',  placeholder: '+91 98765 43210', type: 'phone-pad',     required: false },
  { key: 'password', label: 'Password',          placeholder: 'Min 6 characters',type: 'default',       required: true, secure: true },
  { key: 'confirm',  label: 'Confirm Password',  placeholder: 'Repeat password', type: 'default',       required: true, secure: true },
];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm]     = useState({ name:'', email:'', phone:'', password:'', confirm:'' });
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Missing fields', 'Name, email and password are required.'); return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.'); return;
    }
    if (form.password !== form.confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.'); return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email.trim(), phone: form.phone, password: form.password });
    } catch (err) {
      Alert.alert('Registration failed', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={styles.logoIcon}>🚂</Text>
          <Text style={styles.logoText}>Sahyatri</Text>
          <Text style={styles.logoSub}>Create your passenger account</Text>
        </View>

        <View style={styles.card}>
          {FIELDS.map(f => (
            <View key={f.key} style={styles.inputGroup}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textMuted}
                value={form[f.key]}
                onChangeText={set(f.key)}
                keyboardType={f.type}
                secureTextEntry={!!f.secure}
                autoCapitalize={f.key === 'email' ? 'none' : 'words'}
                returnKeyType="next"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>🚀 Create Account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.bgPrimary },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoWrap:  { alignItems: 'center', marginBottom: spacing.lg },
  logoIcon:  { fontSize: 48, marginBottom: 6 },
  logoText:  { fontSize: 28, fontWeight: '800', color: colors.accentSaffron },
  logoSub:   { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  inputGroup: { marginBottom: spacing.md },
  label:      { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  btn: {
    backgroundColor: colors.accentBlue, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow:     { marginTop: spacing.md, alignItems: 'center' },
  linkText:    { color: colors.textMuted, fontSize: 14 },
  link:        { color: colors.accentBlue, fontWeight: '600' },
});
