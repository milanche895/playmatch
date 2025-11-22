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
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            sx={{ 
              flexGrow: { xs: 1, md: 0 },
              mr: { md: 4 },
              fontWeight: 600
            }} 
            component={RouterLink} 
            to="/" 
            color="inherit" 
            style={{ textDecoration: 'none' }}
          >
            PlayMatch Global
          </Typography>
          <Stack 
            direction="row" 
            spacing={1}
            sx={{ 
              display: { xs: 'none', md: 'flex' },
              flexGrow: 1
            }}
          >
            <Button color="inherit" component={RouterLink} to="/">
              Početna
            </Button>
            {user?.role === 'court' ? (
              <Button color="inherit" component={RouterLink} to="/manage-fields">
                Moji Tereni
              </Button>
            ) : user ? (
              <Button color="inherit" component={RouterLink} to="/create">
                Kreiraj Meč
              </Button>
            ) : null}
          </Stack>
          <Stack 
            direction="row" 
            spacing={1}
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            {user ? (
              <Button color="inherit" onClick={handleLogout}>
                Odjavi se
              </Button>
            ) : (
              <>
                <Button color="inherit" component={RouterLink} to="/login">
                  Prijava
                </Button>
                <Button color="inherit" component={RouterLink} to="/register">
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


