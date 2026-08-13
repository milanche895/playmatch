import { useState } from "react";
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
  useMediaQuery,
  Avatar,
  Tooltip,
  Badge,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import SportsIcon from "@mui/icons-material/Sports";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import InstallButton from "./InstallButton";
import PlejkoLogo from "./PlejkoLogo";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    setMobileOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  // Navigation items with icons
  const getNavItems = () => [
    { 
      label: "Početna", 
      path: "/", 
      show: true,
      icon: <HomeIcon fontSize="small" />
    },
    {
      label: user?.role === "court" ? "Moji Tereni" : "Kreiraj Meč",
      path: user?.role === "court" ? "/manage-fields" : "/create",
      show: !!user,
      icon: user?.role === "court" ? <SportsIcon fontSize="small" /> : <AddCircleIcon fontSize="small" />
    },
    {
      label: "Moji Termini",
      path: "/moji-termini",
      show: !!user && user?.role === "court",
      icon: <SettingsIcon fontSize="small" />
    },
    {
      label: "Moji Mečevi",
      path: "/moji-mecevi",
      show: !!user && user?.role === "player",
      icon: <EventAvailableIcon fontSize="small" />
    },
    {
      label: "Moji Igrači",
      path: "/moji-igraci",
      show: !!user && user?.role === "player",
      icon: <PeopleIcon fontSize="small" />
    },
    {
      label: "Obaveštenja",
      path: "/notification-settings",
      show: !!user && user?.role === "player",
      icon: <NotificationsIcon fontSize="small" />
    },
    {
      label: "Moj Profil",
      path: "/profil",
      show: !!user && user?.role === "player",
      icon: <PersonIcon fontSize="small" />
    },
    { 
      label: "Prijava", 
      path: "/login", 
      show: !user,
      icon: <LoginIcon fontSize="small" />
    },
    { 
      label: "Registracija", 
      path: "/register", 
      show: !user,
      icon: <AppRegistrationIcon fontSize="small" />
    },
  ];

  const navItems = getNavItems().filter(item => item.show);

  const drawer = (
    <Box sx={{ textAlign: "left", pt: 2, px: 2 }}>
      {/* Logo in drawer */}
      <Box
        component={RouterLink}
        to="/"
        onClick={() => setMobileOpen(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          textDecoration: "none",
          mb: 3,
          px: 1,
        }}
      >
        <PlejkoLogo size="sm" />
      </Box>

      {/* User info if logged in */}
      {user && (
        <Box sx={{ mb: 3, px: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar 
              sx={{ 
                width: 40, 
                height: 40,
                bgcolor: 'primary.main',
                fontWeight: 600,
              }}
            >
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.role === 'court' ? 'Vlasnik terena' : 'Igrač'}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      <List sx={{ px: 0 }}>
        {navItems.map((item) => (
          <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isActive(item.path)}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ mr: 2, color: isActive(item.path) ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </Box>
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: isActive(item.path) ? 600 : 500,
                  color: isActive(item.path) ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {user && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton 
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ mr: 2, color: 'text.secondary' }}>
                <LogoutIcon fontSize="small" />
              </Box>
              <ListItemText 
                primary="Odjavi se"
                primaryTypographyProps={{
                  fontWeight: 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      {/* Dark mode toggle in drawer */}
      <Box sx={{ mt: 2, px: 1 }}>
        <ListItemButton
          onClick={toggleColorMode}
          sx={{
            borderRadius: 2,
            py: 1.5,
          }}
        >
          <Box sx={{ mr: 2, color: 'text.secondary' }}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </Box>
          <ListItemText 
            primary={mode === 'dark' ? 'Svetla tema' : 'Tamna tema'}
            primaryTypographyProps={{
              fontWeight: 500,
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          bgcolor: 'background.default',
          color: 'text.primary',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {/* Logo - Left */}
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              mr: 'auto',
            }}
          >
            <PlejkoLogo size="sm" />
          </Box>

          {/* Desktop Navigation */}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.label}
                component={RouterLink}
                to={item.path}
                startIcon={item.icon}
                sx={{
                  color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                  fontWeight: isActive(item.path) ? 600 : 500,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}

            {user && (
              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon fontSize="small" />}
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                  },
                }}
              >
                Odjavi se
              </Button>
            )}

            {/* Dark mode toggle - desktop */}
            <Tooltip title={mode === 'dark' ? 'Svetla tema' : 'Tamna tema'}>
              <IconButton
                onClick={toggleColorMode}
                sx={{
                  ml: 1,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'text.primary',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            <InstallButton />
          </Stack>

          {/* Mobile Controls */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <InstallButton />
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              sx={{
                color: 'text.primary',
              }}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { 
            boxSizing: "border-box", 
            width: 280,
            bgcolor: 'background.paper',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
