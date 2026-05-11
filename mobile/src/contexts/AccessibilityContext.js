import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AccessibilityContext = createContext(null);

const DEFAULT = {
  mode:         'none',  // none | wheelchair | elderly | visually_impaired
  avoidStairs:  false,
  preferLift:   false,
  highContrast: false,
  largeText:    false,
};

const STORAGE_KEY = 'sahyatri_accessibility';

export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT);

  // Load saved settings on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try { setSettings(prev => ({ ...prev, ...JSON.parse(raw) })); } catch (_) {}
      }
    });
  }, []);

  const updateSettings = useCallback((partial) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isAccessible = settings.avoidStairs || settings.preferLift;

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, isAccessible }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be inside AccessibilityProvider');
  return ctx;
};
