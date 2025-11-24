import { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Stack, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMobileOpen(false);
  };

  const navItems = [
    { label: 'Početna', path: '/', show: true },
    { 
      label: user?.role === 'court' ? 'Moji Tereni' : 'Kreiraj Meč', 
      path: user?.role === 'court' ? '/manage-fields' : '/create',
      show: !!user
    },
    { 
      label: 'Moji Termini', 
      path: '/moji-termini',
      show: !!user && user?.role === 'court'
    },
    { label: 'Prijava', path: '/login', show: !user },
    { label: 'Registracija', path: '/register', show: !user },
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center', pt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        PlayMatch Global
      </Typography>
      <List>
        {navItems
          .filter(item => item.show)
          .map((item) => (
            <ListItem key={item.label} disablePadding>
              <ListItemButton 
                component={RouterLink} 
                to={item.path}
                sx={{ textAlign: 'center' }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        {user && (
          <ListItem disablePadding>
            <ListItemButton 
              onClick={handleLogout}
              sx={{ textAlign: 'center' }}
            >
              <ListItemText primary="Odjavi se" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: '#2e7d32' }}>
        <Toolbar sx={{ minHeight: { xs: 48, sm: 64 }, px: { xs: 1, sm: 2 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { md: 'none' }, p: { xs: 0.75, sm: 1 } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            sx={{ 
              flexGrow: { xs: 1, md: 0 },
              mr: { md: 4 },
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }} 
            component={RouterLink} 
            to="/" 
            color="inherit" 
            style={{ textDecoration: 'none' }}
          >
            ⚽ PlayMatch
          </Typography>
          <Stack 
            direction="row" 
            spacing={{ xs: 0.5, sm: 1 }}
            sx={{ 
              display: { xs: 'none', md: 'flex' },
              flexGrow: 1
            }}
          >
            <Button 
              color="inherit" 
              component={RouterLink} 
              to="/"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
            >
              Početna
            </Button>
            {user?.role === 'court' ? (
              <>
                <Button 
                  color="inherit" 
                  component={RouterLink} 
                  to="/manage-fields"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
                >
                  Moji Tereni
                </Button>
                <Button 
                  color="inherit" 
                  component={RouterLink} 
                  to="/moji-termini"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
                >
                  Moji Termini
                </Button>
              </>
            ) : user ? (
              <Button 
                color="inherit" 
                component={RouterLink} 
                to="/create"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
              >
                Kreiraj Meč
              </Button>
            ) : null}
          </Stack>
          <Stack 
            direction="row" 
            spacing={{ xs: 0.5, sm: 1 }}
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            {user ? (
              <Button 
                color="inherit" 
                onClick={handleLogout}
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
              >
                Odjavi se
              </Button>
            ) : (
              <>
                <Button 
                  color="inherit" 
                  component={RouterLink} 
                  to="/login"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
                >
                  Prijava
                </Button>
                <Button 
                  color="inherit" 
                  component={RouterLink} 
                  to="/register"
                  sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 2 } }}
                >
                  Registracija
                </Button>
              </>
            )}
          </Stack>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}


