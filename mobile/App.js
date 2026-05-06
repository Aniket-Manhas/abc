import 'react-native-url-polyfill/auto';
import './src/i18n';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { EmergencyProvider } from './src/contexts/EmergencyContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0f0f11" />
      <AuthProvider>
        <SocketProvider>
          <AccessibilityProvider>
            <EmergencyProvider>
              <AppNavigator />
            </EmergencyProvider>
          </AccessibilityProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
