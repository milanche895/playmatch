import { createTheme, PaletteMode } from '@mui/material/styles';

// Plei-inspired design tokens
const designTokens = {
  colors: {
    // Primary - Cypress Green (Plei's signature accent)
    cypress: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // Main cypress green
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    // Neutral scale
    gray: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
      950: '#09090b',
    },
    // Status colors
    status: {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  }
};

// Create theme based on mode
export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: designTokens.colors.cypress[500],
        light: designTokens.colors.cypress[400],
        dark: designTokens.colors.cypress[600],
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? designTokens.colors.gray[700] : designTokens.colors.gray[200],
        light: isDark ? designTokens.colors.gray[600] : designTokens.colors.gray[100],
        dark: isDark ? designTokens.colors.gray[800] : designTokens.colors.gray[300],
        contrastText: isDark ? '#ffffff' : designTokens.colors.gray[900],
      },
      success: {
        main: designTokens.colors.status.success,
        light: '#86efac',
        dark: '#16a34a',
        contrastText: '#ffffff',
      },
      warning: {
        main: designTokens.colors.status.warning,
        light: '#fcd34d',
        dark: '#d97706',
        contrastText: '#ffffff',
      },
      error: {
        main: designTokens.colors.status.error,
        light: '#fca5a5',
        dark: '#dc2626',
        contrastText: '#ffffff',
      },
      info: {
        main: designTokens.colors.status.info,
        light: '#93c5fd',
        dark: '#2563eb',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? designTokens.colors.gray[950] : designTokens.colors.gray[50],
        paper: isDark ? designTokens.colors.gray[900] : '#ffffff',
      },
      text: {
        primary: isDark ? '#fafafa' : designTokens.colors.gray[900],
        secondary: isDark ? designTokens.colors.gray[400] : designTokens.colors.gray[600],
        disabled: isDark ? designTokens.colors.gray[600] : designTokens.colors.gray[400],
      },
      divider: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.5rem',
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.25rem',
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.125rem',
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.4,
      },
      subtitle1: {
        fontWeight: 500,
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      subtitle2: {
        fontWeight: 500,
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      body1: {
        fontWeight: 400,
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontWeight: 400,
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        fontWeight: 600,
        fontSize: '0.875rem',
        lineHeight: 1.5,
        textTransform: 'none',
        letterSpacing: '0',
      },
      caption: {
        fontWeight: 500,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        letterSpacing: '0.01em',
      },
      overline: {
        fontWeight: 600,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        letterSpacing: '0.08em',
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
          '*': {
            boxSizing: 'border-box',
          },
          html: {
            scrollBehavior: 'smooth',
          },
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
            padding: '10px 20px',
            fontWeight: 600,
            transition: 'all 0.2s ease-in-out',
          },
          contained: {
            boxShadow: isDark 
              ? '0 1px 3px rgba(0,0,0,0.3)' 
              : '0 1px 3px rgba(0,0,0,0.1)',
            '&:hover': {
              boxShadow: isDark 
                ? '0 4px 12px rgba(34,197,94,0.3)' 
                : '0 4px 12px rgba(34,197,94,0.25)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${designTokens.colors.cypress[500]} 0%, ${designTokens.colors.cypress[600]} 100%)`,
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
            },
          },
          sizeLarge: {
            padding: '14px 24px',
            fontSize: '1rem',
          },
          sizeSmall: {
            padding: '6px 14px',
            fontSize: '0.8125rem',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
            boxShadow: isDark 
              ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
            border: isDark 
              ? `1px solid ${designTokens.colors.gray[800]}` 
              : `1px solid ${designTokens.colors.gray[200]}`,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: isDark 
                ? '0 8px 25px rgba(0,0,0,0.4)'
                : '0 8px 25px rgba(0,0,0,0.1)',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: designTokens.spacing.lg,
            '&:last-child': {
              paddingBottom: designTokens.spacing.lg,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: isDark 
              ? '0 1px 3px rgba(0,0,0,0.3)' 
              : '0 1px 3px rgba(0,0,0,0.08)',
            borderBottom: isDark 
              ? `1px solid ${designTokens.colors.gray[800]}` 
              : `1px solid ${designTokens.colors.gray[200]}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: designTokens.borderRadius.sm,
            height: 28,
          },
          colorPrimary: {
            backgroundColor: isDark 
              ? `${designTokens.colors.cypress[500]}20`
              : `${designTokens.colors.cypress[500]}15`,
            color: designTokens.colors.cypress[600],
            border: `1px solid ${isDark 
              ? `${designTokens.colors.cypress[500]}30`
              : `${designTokens.colors.cypress[500]}25`}`,
          },
          colorSuccess: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.success}20`
              : `${designTokens.colors.status.success}15`,
            color: designTokens.colors.status.success,
          },
          colorWarning: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.warning}20`
              : `${designTokens.colors.status.warning}15`,
            color: designTokens.colors.status.warning,
          },
          colorError: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.error}20`
              : `${designTokens.colors.status.error}15`,
            color: designTokens.colors.status.error,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: designTokens.borderRadius.lg,
              backgroundColor: isDark ? designTokens.colors.gray[800] : designTokens.colors.gray[50],
              '& fieldset': {
                borderColor: isDark ? designTokens.colors.gray[700] : designTokens.colors.gray[300],
                borderWidth: '1.5px',
              },
              '&:hover fieldset': {
                borderColor: isDark ? designTokens.colors.gray[600] : designTokens.colors.gray[400],
              },
              '&.Mui-focused fieldset': {
                borderColor: designTokens.colors.cypress[500],
                borderWidth: '2px',
              },
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? designTokens.colors.gray[900] : '#ffffff',
            borderRight: isDark 
              ? `1px solid ${designTokens.colors.gray[800]}` 
              : `1px solid ${designTokens.colors.gray[200]}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: isDark 
              ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          },
          elevation2: {
            boxShadow: isDark 
              ? '0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)'
              : '0 4px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)',
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? designTokens.colors.gray[900] : '#ffffff',
            borderTop: isDark 
              ? `1px solid ${designTokens.colors.gray[800]}` 
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
              color: designTokens.colors.cypress[500],
            },
          },
          label: {
            fontSize: '0.75rem',
            fontWeight: 500,
            '&.Mui-selected': {
              fontWeight: 600,
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.md,
            margin: '4px 8px',
            '&:hover': {
              backgroundColor: isDark 
                ? `${designTokens.colors.cypress[500]}10`
                : `${designTokens.colors.cypress[500]}08`,
            },
            '&.Mui-selected': {
              backgroundColor: isDark 
                ? `${designTokens.colors.cypress[500]}20`
                : `${designTokens.colors.cypress[500]}12`,
              color: designTokens.colors.cypress[600],
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.md,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: designTokens.borderRadius.xl,
            boxShadow: isDark 
              ? '0 25px 50px rgba(0,0,0,0.5)'
              : '0 25px 50px rgba(0,0,0,0.15)',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
          },
          standardSuccess: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.success}15`
              : `${designTokens.colors.status.success}10`,
            color: isDark ? '#86efac' : '#15803d',
          },
          standardWarning: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.warning}15`
              : `${designTokens.colors.status.warning}10`,
            color: isDark ? '#fcd34d' : '#b45309',
          },
          standardError: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.error}15`
              : `${designTokens.colors.status.error}10`,
            color: isDark ? '#fca5a5' : '#dc2626',
          },
          standardInfo: {
            backgroundColor: isDark 
              ? `${designTokens.colors.status.info}15`
              : `${designTokens.colors.status.info}10`,
            color: isDark ? '#93c5fd' : '#2563eb',
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: isDark 
              ? designTokens.colors.gray[800] 
              : designTokens.colors.gray[200],
            borderRadius: designTokens.borderRadius.md,
          },
        },
      },
    },
  });
};

export { designTokens };
export default createAppTheme;
