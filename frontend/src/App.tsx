import { Component, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Container, CircularProgress, Box, Typography, Button } from '@mui/material';
import { ThemeProvider as CustomThemeProvider, useThemeMode } from './context/ThemeContext';
import createAppTheme from './theme';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CreateMatch from './pages/CreateMatch';
import MatchDetails from './pages/MatchDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import ManageFields from './pages/ManageFields';
import MojTermine from './pages/MojTermine';
import PlayerProfile from './pages/PlayerProfile';
import MojiMecevi from './pages/MojiMecevi';
import MojiIgraci from './pages/MojiIgraci';
import NotificationSettings from './pages/NotificationSettings';
import { AuthProvider, useAuth } from './context/AuthContext';

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

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppContent() {
  const { loading } = useAuth();
  const { mode } = useThemeMode();
  const theme = createAppTheme(mode);

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
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/create"
                element={
                  <ProtectedRoute>
                    <CreateMatch />
                  </ProtectedRoute>
                }
              />
              <Route path="/matches/:id" element={<MatchDetails />} />
              <Route
                path="/manage-fields"
                element={
                  <ProtectedRoute>
                    <ManageFields />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/moji-termini"
                element={
                  <ProtectedRoute>
                    <MojTermine />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profil"
                element={
                  <ProtectedRoute>
                    <PlayerProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/moji-mecevi"
                element={
                  <ProtectedRoute>
                    <MojiMecevi />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/moji-igraci"
                element={
                  <ProtectedRoute>
                    <MojiIgraci />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notification-settings"
                element={
                  <ProtectedRoute>
                    <NotificationSettings />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
          </Container>
        </Box>
      </Box>
    </MuiThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CustomThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </CustomThemeProvider>
    </ErrorBoundary>
  );
}
