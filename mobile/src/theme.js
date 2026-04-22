// Sahyatri Design System — Dark Theme
export const colors = {
  // Backgrounds
  bgPrimary:    '#0f0f11',
  bgSecondary:  '#1a1a1d',
  bgElevated:   '#26262b',
  bgCard:       '#1e1e22',

  // Accents
  accentSaffron: '#e8a020',
  accentBlue:    '#3b82f6',
  accentCyan:    '#06b6d4',
  accentPurple:  '#8b5cf6',
  accentGreen:   '#22c55e',

  // Crowd density
  crowdLow:    '#27ae60',
  crowdMedium: '#e67e22',
  crowdHigh:   '#e74c3c',

  // Text
  textPrimary:   '#f1f1f3',
  textSecondary: '#a0a0b0',
  textMuted:     '#606070',
  textOnAccent:  '#1a1a1d',

  // Borders
  border:       'rgba(255,255,255,0.08)',
  borderBright: 'rgba(255,255,255,0.14)',

  // Utility
  white:  '#ffffff',
  danger: '#ef4444',
  error:  '#e74c3c',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 999,
};

export const typography = {
  h1:      { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  h2:      { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  h3:      { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  body:    { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  bodyMd:  { fontSize: 14, fontWeight: '400', color: colors.textSecondary },
  bodySm:  { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  label:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  caption: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  mono:    { fontSize: 13, fontFamily: 'monospace', color: colors.textPrimary },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
};
