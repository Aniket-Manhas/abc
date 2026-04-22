import React, { createContext, useContext, useState, useCallback } from 'react';

const AccessibilityContext = createContext(null);

const DEFAULT = {
  mode:         'none',  // none | wheelchair | elderly | visually_impaired
  avoidStairs:  false,
  preferLift:   false,
  highContrast: false,
  largeText:    false,
};

export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT);

  const updateSettings = useCallback((partial) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  const isAccessible = settings.avoidStairs || settings.preferLift;

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, isAccessible }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be inside AccessibilityProvider');
  return ctx;
};
