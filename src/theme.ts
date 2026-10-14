import type { CSSProperties } from 'react';
import { createTheme, PaletteMode, alpha } from '@mui/material/styles';

// Design-system additions (Screen 16): secondary / destructive buttons and Inter type scale
declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    /** Secondary button: soft blue-gray background, dark text. */
    soft: true;
    /** Destructive button: solid red background, white text. */
    destructive: true;
  }
}

declare module '@mui/material/styles' {
  interface TypographyVariants {
    heading1: CSSProperties;
    heading2: CSSProperties;
    bodyText: CSSProperties;
    label: CSSProperties;
  }
  interface TypographyVariantsOptions {
    heading1?: CSSProperties;
    heading2?: CSSProperties;
    bodyText?: CSSProperties;
    label?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    heading1: true;
    heading2: true;
    bodyText: true;
    label: true;
  }
}

/** Plejko brand tokens — cyan → magenta, dark navy base */
export const brand = {
  cyan: '#00D4FF',
  blue: '#2B6CFF',
  magenta: '#D400FF',
  purple: '#8A2BE2',
  green: '#00E676',
  orange: '#FF9100',
  yellow: '#FFD600',
  navy: '#050A18',
  navySoft: '#0B1228',
  navyCard: '#121A33',
  gradient: 'linear-gradient(135deg, #00D4FF 0%, #2B6CFF 45%, #D400FF 100%)',
  gradientHorizontal: 'linear-gradient(90deg, #00D4FF 0%, #8A2BE2 50%, #D400FF 100%)',
  glowCyan: '0 0 24px rgba(0, 212, 255, 0.35)',
  glowMagenta: '0 0 24px rgba(212, 0, 255, 0.3)',
};

/** Light-mode UI tokens taken from the reference screenshots. */
export const lightUi = {
  primary: '#0877F9',
  background: '#F4F7FC',
  border: '#E3E9F3',
  textPrimary: '#0B1B3F',
  textSecondary: '#6B7A99',
};

const designTokens = {
  colors: {
    gray: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    status: {
      success: brand.green,
      warning: brand.orange,
      error: '#FF3B5C',
      info: brand.cyan,
    },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};

export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? {
            main: brand.cyan,
            light: '#5CE1FF',
            dark: brand.blue,
            contrastText: '#ffffff',
          }
        : {
            main: lightUi.primary,
            light: '#4D9DFB',
            dark: '#0560C7',
            contrastText: '#ffffff',
          },
      secondary: {
        main: brand.magenta,
        light: '#E866FF',
        dark: brand.purple,
        contrastText: '#ffffff',
      },
      success: {
        main: designTokens.colors.status.success,
        light: '#69F0AE',
        dark: '#00C853',
        contrastText: '#003910',
      },
      warning: {
        main: designTokens.colors.status.warning,
        light: '#FFB74D',
        dark: '#F57C00',
        contrastText: '#3E1F00',
      },
      error: {
        main: designTokens.colors.status.error,
        light: '#FF8A9B',
        dark: '#D50032',
        contrastText: '#ffffff',
      },
      info: {
        main: designTokens.colors.status.info,
        light: '#80EAFF',
        dark: brand.blue,
        contrastText: '#003344',
      },
      background: {
        default: isDark ? brand.navy : lightUi.background,
        paper: isDark ? brand.navyCard : '#ffffff',
      },
      text: {
        primary: isDark ? '#F8FAFC' : lightUi.textPrimary,
        secondary: isDark ? designTokens.colors.gray[400] : lightUi.textSecondary,
        disabled: isDark ? designTokens.colors.gray[600] : designTokens.colors.gray[400],
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : lightUi.border,
    },
    typography: {
      fontFamily:
        '"Inter", "Nunito", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontWeight: 800,
        fontSize: '2.5rem',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 800,
        fontSize: '2rem',
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontWeight: 700,
        fontSize: '1.5rem',
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontWeight: 700,
        fontSize: '1.25rem',
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontWeight: 700,
        fontSize: '1.125rem',
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 700,
        fontSize: '1rem',
        lineHeight: 1.4,
      },
      subtitle1: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      subtitle2: {
        fontWeight: 600,
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      body1: {
        fontWeight: 500,
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontWeight: 500,
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        fontWeight: 700,
        fontSize: '0.875rem',
        lineHeight: 1.5,
        textTransform: 'none',
        letterSpacing: '0',
      },
      caption: {
        fontWeight: 600,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        letterSpacing: '0.01em',
      },
      // Design-system type scale (size/line-height): H1 32/40 Bold, H2 24/32 Semibold, Body 16/24 Regular, Label 14/20 Medium
      heading1: { fontWeight: 700, fontSize: '2rem', lineHeight: '40px' },
      heading2: { fontWeight: 600, fontSize: '1.5rem', lineHeight: '32px' },
      bodyText: { fontWeight: 400, fontSize: '1rem', lineHeight: '24px' },
      label: { fontWeight: 500, fontSize: '0.875rem', lineHeight: '20px' },
      overline: {
        fontWeight: 700,
        fontSize: '0.7rem',
        lineHeight: 1.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      },
    },
    shape: {
      borderRadius: designTokens.borderRadius.md,
    },
    spacing: 4,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box' },
          html: { scrollBehavior: 'smooth', overflowX: 'hidden' },
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            overflowX: 'hidden',
          },
          // Soft map look (home map view)
          '.plejko-map-tiles': { filter: 'saturate(0.6) brightness(1.05) contrast(0.96)' },
          '.leaflet-top.leaflet-right .leaflet-control-attribution': {
            margin: '8px',
            padding: '2px 8px',
            borderRadius: 8,
            fontSize: 10,
          },
          // Leaflet popups must fit narrow phone screens
          '.leaflet-popup-content-wrapper': {
            maxWidth: 'min(360px, 85vw) !important',
          },
          '.leaflet-popup-content': {
            margin: '10px 12px !important',
            maxWidth: 'min(340px, calc(85vw - 24px)) !important',
          },
        },
      },
      MuiTypography: {
        defaultProps: {
          variantMapping: { heading1: 'h1', heading2: 'h2', bodyText: 'p', label: 'span' },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        variants: [
          {
            props: { variant: 'soft' },
            style: {
              color: isDark ? '#F8FAFC' : lightUi.textPrimary,
              backgroundColor: isDark ? alpha('#fff', 0.08) : '#E9EEF6',
              '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.14) : '#DFE6F1' },
            },
          },
          {
            props: { variant: 'destructive' },
            style: {
              color: '#fff',
              backgroundColor: '#F0524F',
              '&:hover': { backgroundColor: '#E0413E' },
            },
          },
        ],
        styleOverrides: {
          root: {
            borderRadius: isDark ? designTokens.borderRadius.full : 12,
            padding: '10px 22px',
            fontWeight: isDark ? 700 : 600,
            transition: 'all 0.2s ease-in-out',
          },
          contained: isDark
            ? {
                boxShadow: '0 4px 16px rgba(0, 212, 255, 0.2)',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(212, 0, 255, 0.3)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }
            : {
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              },
          containedPrimary: isDark
            ? {
                background: brand.gradient,
                color: '#fff',
                '&:hover': {
                  background: brand.gradientHorizontal,
                },
              }
            : {
                backgroundColor: lightUi.primary,
                color: '#fff',
                '&:hover': {
                  backgroundColor: '#0560C7',
                },
              },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
            },
          },
          sizeLarge: {
            padding: '14px 28px',
            fontSize: '1rem',
          },
          sizeSmall: {
            padding: '6px 16px',
            fontSize: '0.8125rem',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : 'none',
            border: isDark
              ? `1px solid ${alpha('#fff', 0.08)}`
              : `1px solid ${lightUi.border}`,
            backgroundImage: isDark
              ? `linear-gradient(180deg, ${alpha(brand.cyan, 0.04)} 0%, transparent 40%)`
              : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': isDark
              ? {
                  boxShadow: `0 8px 28px rgba(0,0,0,0.45), ${brand.glowCyan}`,
                  transform: 'translateY(-2px)',
                  borderColor: alpha(brand.cyan, 0.25),
                }
              : {},
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 24,
            '@media (max-width:600px)': {
              padding: 16,
              '&:last-child': { paddingBottom: 16 },
            },
            '&:last-child': { paddingBottom: 24 },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: isDark
              ? `1px solid ${alpha('#fff', 0.08)}`
              : `1px solid ${designTokens.colors.gray[200]}`,
            backgroundImage: isDark
              ? `linear-gradient(180deg, ${brand.navySoft} 0%, ${brand.navy} 100%)`
              : 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            borderRadius: designTokens.borderRadius.full,
            height: 28,
          },
          colorPrimary: {
            backgroundColor: alpha(brand.cyan, isDark ? 0.18 : 0.12),
            color: isDark ? brand.cyan : brand.blue,
            border: `1px solid ${alpha(brand.cyan, 0.35)}`,
          },
          colorSecondary: {
            backgroundColor: alpha(brand.magenta, isDark ? 0.18 : 0.12),
            color: isDark ? '#E866FF' : brand.magenta,
            border: `1px solid ${alpha(brand.magenta, 0.35)}`,
          },
          colorSuccess: {
            backgroundColor: alpha(brand.green, isDark ? 0.18 : 0.12),
            color: brand.green,
          },
          colorWarning: {
            backgroundColor: alpha(brand.orange, isDark ? 0.18 : 0.12),
            color: brand.orange,
          },
          colorError: {
            backgroundColor: alpha('#FF3B5C', isDark ? 0.18 : 0.12),
            color: '#FF3B5C',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: designTokens.borderRadius.lg,
              backgroundColor: isDark ? brand.navySoft : designTokens.colors.gray[50],
              '& fieldset': {
                borderColor: isDark ? alpha('#fff', 0.12) : designTokens.colors.gray[300],
                borderWidth: '1.5px',
              },
              '&:hover fieldset': {
                borderColor: isDark ? alpha(brand.cyan, 0.4) : designTokens.colors.gray[400],
              },
              '&.Mui-focused fieldset': {
                borderColor: brand.cyan,
                borderWidth: '2px',
              },
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { borderRadius: designTokens.borderRadius.lg },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: designTokens.borderRadius.lg },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? brand.navySoft : '#ffffff',
            borderRight: isDark
              ? `1px solid ${alpha('#fff', 0.08)}`
              : `1px solid ${designTokens.colors.gray[200]}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.08)',
          },
          elevation2: {
            boxShadow: isDark
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? brand.navyCard : '#ffffff',
            borderTop: isDark
              ? `1px solid ${alpha('#fff', 0.08)}`
              : `1px solid ${designTokens.colors.gray[200]}`,
            height: 64,
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            color: isDark ? designTokens.colors.gray[500] : designTokens.colors.gray[500],
            '&.Mui-selected': {
              color: brand.cyan,
            },
          },
          label: {
            fontSize: '0.75rem',
            fontWeight: 600,
            '&.Mui-selected': { fontWeight: 700 },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? alpha('#fff', 0.08) : 'rgba(0,0,0,0.08)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.md,
            margin: '4px 8px',
            '&:hover': {
              backgroundColor: alpha(brand.cyan, isDark ? 0.1 : 0.08),
            },
            '&.Mui-selected': {
              backgroundColor: alpha(brand.cyan, isDark ? 0.18 : 0.12),
              color: isDark ? brand.cyan : brand.blue,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: designTokens.borderRadius.md },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: designTokens.borderRadius.xl,
            boxShadow: isDark
              ? '0 25px 50px rgba(0,0,0,0.6)'
              : '0 25px 50px rgba(0,0,0,0.15)',
            border: isDark ? `1px solid ${alpha('#fff', 0.08)}` : undefined,
            margin: 16,
            maxHeight: 'calc(100% - 32px)',
            '@media (max-width:600px)': {
              margin: 8,
              maxHeight: 'calc(100% - 16px)',
              width: 'calc(100% - 16px)',
              borderRadius: designTokens.borderRadius.lg,
            },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              flexDirection: 'column-reverse',
              alignItems: 'stretch',
              gap: 8,
              '& > :not(:first-of-type)': { marginLeft: 0 },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: designTokens.borderRadius.lg },
          standardSuccess: {
            backgroundColor: alpha(brand.green, isDark ? 0.15 : 0.1),
            color: isDark ? '#69F0AE' : '#007A3D',
          },
          standardWarning: {
            backgroundColor: alpha(brand.orange, isDark ? 0.15 : 0.1),
            color: isDark ? '#FFB74D' : '#B45309',
          },
          standardError: {
            backgroundColor: alpha('#FF3B5C', isDark ? 0.15 : 0.1),
            color: isDark ? '#FF8A9B' : '#C62828',
          },
          standardInfo: {
            backgroundColor: alpha(brand.cyan, isDark ? 0.15 : 0.1),
            color: isDark ? '#80EAFF' : brand.blue,
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? brand.navySoft : designTokens.colors.gray[200],
            borderRadius: designTokens.borderRadius.md,
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          primary: isDark
            ? {
                background: brand.gradient,
                color: '#fff',
                '&:hover': {
                  background: brand.gradientHorizontal,
                },
              }
            : {
                backgroundColor: lightUi.primary,
                color: '#fff',
                boxShadow: '0 8px 20px rgba(8, 119, 249, 0.30)',
                '&:hover': {
                  backgroundColor: '#0560C7',
                },
              },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          colorPrimary: {
            color: isDark ? brand.cyan : lightUi.primary,
          },
        },
      },
    },
  });
};

export { designTokens };
export default createAppTheme;
