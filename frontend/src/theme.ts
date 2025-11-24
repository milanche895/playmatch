import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { 
      main: '#2e7d32', // Forest green - football field color
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#ffffff', // White - field lines
      dark: '#f5f5f5',
      contrastText: '#2e7d32'
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20'
    },
    warning: {
      main: '#ff9800', // Orange for full matches
    },
    error: {
      main: '#d32f2f', // Red for cancelled
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 600
        },
        contained: {
          boxShadow: '0 2px 8px rgba(46, 125, 50, 0.2)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500
        }
      }
    }
  }
});

export default theme;


