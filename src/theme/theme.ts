'use client';

import { createTheme } from '@mui/material/styles';
import type { Shadows } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    elevated: string;
  }
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}

const colors = {
  background: '#101016',
  surface: '#191922',
  elevated: '#252530',
  primary: '#D2FF5A',
  primaryHover: '#BDE94A',
  secondary: '#A78BFA',
  secondaryHover: '#BEAAFF',
  text: '#F7F6F2',
  textSecondary: '#B9B8C8',
  coral: '#FF8B78',
  border: '#42424F',
  hover: '#30303C',
  selected: '#383C31',
  disabled: '#858592',
  disabledBackground: '#303039',
  success: '#88DDB0',
  warning: '#FFD080',
  info: '#8DCBFF',
} as const;

const focusRing = { outline: `2px solid ${colors.primary}`, outlineOffset: 2 };
const shadows = Array.from({ length: 25 }, (_, level) => level === 0 ? 'none' :
  level < 4 ? '0 4px 16px rgba(0, 0, 0, 0.22)' : '0 12px 32px rgba(0, 0, 0, 0.32)') as Shadows;

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: colors.primary, contrastText: colors.background },
    secondary: { main: colors.secondary, contrastText: colors.background },
    error: { main: colors.coral, contrastText: colors.background },
    success: { main: colors.success, contrastText: colors.background },
    warning: { main: colors.warning, contrastText: colors.background },
    info: { main: colors.info, contrastText: colors.background },
    accent: { main: colors.coral, contrastText: colors.background },
    background: { default: colors.background, paper: colors.surface, elevated: colors.elevated },
    text: { primary: colors.text, secondary: colors.textSecondary, disabled: colors.disabled },
    divider: colors.border,
    action: {
      hover: colors.hover,
      selected: colors.selected,
      disabled: colors.disabled,
      disabledBackground: colors.disabledBackground,
      focus: colors.selected,
    },
  },
  typography: {
    fontFamily: 'var(--font-inter), Arial, sans-serif',
    h1: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.035em' },
    h2: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontSize: 'clamp(1.625rem, 3vw, 2rem)', fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.03em' },
    h3: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
    h4: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontWeight: 700, lineHeight: 1.3 },
    h5: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontWeight: 700, lineHeight: 1.35 },
    h6: { fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif', fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45 },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.005em' },
  },
  spacing: 8,
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
  shape: { borderRadius: 12 },
  shadows,
  transitions: { duration: { shorter: 100, short: 150, standard: 220 } },
  components: {
    MuiCssBaseline: { styleOverrides: {
      html: { colorScheme: 'dark' },
      body: { backgroundColor: colors.background, color: colors.text },
    } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, borderRadius: 12, paddingInline: 20, '&.Mui-focusVisible': focusRing,
          '&.MuiButton-contained.MuiButton-colorPrimary:hover': { backgroundColor: colors.primaryHover },
          '&.MuiButton-contained.MuiButton-colorSecondary:hover': { backgroundColor: colors.secondaryHover },
        },
        outlined: { borderColor: colors.border, '&:hover': { borderColor: colors.primary, backgroundColor: colors.hover } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44, '&.Mui-focusVisible': focusRing } } },
    MuiTypography: { styleOverrides: { root: { overflowWrap: 'break-word' } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: {
      root: { minHeight: 44, backgroundColor: colors.surface,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.textSecondary },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
      },
    } },
    MuiSelect: { styleOverrides: { select: { '&:focus-visible': focusRing } } },
    MuiChip: { styleOverrides: {
      root: { minHeight: 32, backgroundColor: colors.elevated, borderColor: colors.border, '&.Mui-focusVisible': focusRing },
      colorPrimary: { backgroundColor: colors.primary, color: colors.background },
      colorSecondary: { backgroundColor: colors.secondary, color: colors.background },
    } },
    MuiCard: { styleOverrides: { root: { borderRadius: 18, backgroundColor: colors.surface, backgroundImage: 'none', border: `1px solid ${colors.border}`, boxShadow: shadows[1] } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: 16 } } },
    MuiDialog: { styleOverrides: { paper: { backgroundColor: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 20 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: { backgroundColor: colors.primary, height: 3 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 44, '&.Mui-focusVisible': focusRing } } },
    MuiDivider: { styleOverrides: { root: { borderColor: colors.border } } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: colors.hover } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12, border: `1px solid ${colors.border}` } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: colors.elevated, color: colors.text, border: `1px solid ${colors.border}`, fontSize: '0.75rem' } } },
  },
});
