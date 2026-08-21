'use client';

import { Component, ReactNode, useEffect } from 'react';
import {
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  Container,
  CircularProgress,
  Box,
  Typography,
  Button,
} from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider as CustomThemeProvider, useThemeMode } from '../context/ThemeContext';
import createAppTheme from '../theme';
import Navbar from '../components/Navbar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { trackPlayerLocation } from '../lib/location';
import PostRegisterNotificationDialog from '../components/PostRegisterNotificationDialog';
import { initPushNotifications } from '../lib/notifications';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh" gap={2}>
          <Typography variant="h6">Nešto je pošlo naopako.</Typography>
          <Button variant="contained" onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}>
            Vrati se na početnu
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { mode } = useThemeMode();
  const theme = createAppTheme(mode);

  useEffect(() => {
    if (user?.role === 'player') {
      trackPlayerLocation();
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    initPushNotifications().catch((err) => {
      console.warn('Failed to initialize push notifications:', err);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Navbar />
        <PostRegisterNotificationDialog />
        <Box
          component="main"
          sx={{
            flex: 1,
            py: { xs: 2, sm: 3 },
            px: { xs: 1.5, sm: 2, md: 3 },
            bgcolor: 'background.default',
          }}
        >
          <Container
            maxWidth={false}
            sx={{
              px: { xs: 0, sm: 1 },
            }}
          >
            {children}
          </Container>
        </Box>
      </Box>
    </MuiThemeProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ErrorBoundary>
        <CustomThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </CustomThemeProvider>
      </ErrorBoundary>
    </AppRouterCacheProvider>
  );
}
