/**
 * useTheme.js
 * A reactive theme hook that returns colors, spacing, and typography
 * adjusted for the current accessibility settings (highContrast + largeText).
 *
 * Usage:
 *   const { colors, fs, spacing, radius } = useTheme();
 *   <Text style={{ color: colors.textPrimary, fontSize: fs(14) }}>Hello</Text>
 */

import { useAccessibility } from './contexts/AccessibilityContext';
import { spacing, radius, shadows } from './theme';

// ── Base dark-mode palette ─────────────────────────────────────────
const BASE = {
  bgPrimary:    '#0f0f11',
  bgSecondary:  '#1a1a1d',
  bgElevated:   '#26262b',
  bgCard:       '#1e1e22',
  accentSaffron: '#e8a020',
  accentBlue:    '#3b82f6',
  accentCyan:    '#06b6d4',
  accentPurple:  '#8b5cf6',
  accentGreen:   '#22c55e',
  crowdLow:    '#27ae60',
  crowdMedium: '#e67e22',
  crowdHigh:   '#e74c3c',
  textPrimary:   '#f1f1f3',
  textSecondary: '#a0a0b0',
  textMuted:     '#606070',
  textOnAccent:  '#1a1a1d',
  border:       'rgba(255,255,255,0.08)',
  borderBright: 'rgba(255,255,255,0.14)',
  white:  '#ffffff',
  danger: '#ef4444',
  error:  '#e74c3c',
};

// ── High-contrast WCAG-AA compliant palette ────────────────────────
// Pure black backgrounds, pure white text, saturated vivid accents.
const HIGH_CONTRAST = {
  bgPrimary:    '#000000',
  bgSecondary:  '#0a0a0a',
  bgElevated:   '#111111',
  bgCard:       '#0d0d0d',
  accentSaffron: '#ffb800',
  accentBlue:    '#4da6ff',
  accentCyan:    '#00e5ff',
  accentPurple:  '#bf7fff',
  accentGreen:   '#00ff6a',
  crowdLow:    '#00e676',
  crowdMedium: '#ffab40',
  crowdHigh:   '#ff5252',
  textPrimary:   '#ffffff',
  textSecondary: '#dddddd',
  textMuted:     '#aaaaaa',
  textOnAccent:  '#000000',
  border:       'rgba(255,255,255,0.25)',
  borderBright: 'rgba(255,255,255,0.45)',
  white:  '#ffffff',
  danger: '#ff5252',
  error:  '#ff5252',
};

export default function useTheme() {
  // Safe fallback if used outside AccessibilityProvider
  let settings = { highContrast: false, largeText: false };
  try {
    const a11y = useAccessibility();
    settings = a11y.settings;
  } catch (_) {}

  const colors = settings.highContrast ? HIGH_CONTRAST : BASE;

  // Font scale: multiply any base font size through this helper
  const scale = settings.largeText ? 1.22 : 1.0;
  const fs = (base) => Math.round(base * scale);

  return { colors, fs, spacing, radius, shadows };
}
