'use client';

import { useEffect, useState } from "react";
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
  Badge,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LocationOnIcon from "@mui/icons-material/LocationOn";
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
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import api from "@/lib/api";
import { Link as RouterLink, useNavigate, useLocation } from '@/lib/router';
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import InstallButton from "./InstallButton";
import PlejkoLogo from "./PlejkoLogo";
import NotificationSetupAlert from "./NotificationSetupAlert";
import MobileHeader from "./MobileHeader";
import BottomNav, { BOTTOM_NAV_VISIBLE_PATHS, COURT_BOTTOM_NAV_PATHS } from "./BottomNav";

/** Court mobile header actions: notification bell (red dot when unread) + profile shortcut. */
function CourtHeaderActions() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ unreadCount?: number }>("/api/notifications")
      .then((res) => {
        if (!cancelled) setUnread(res.data?.unreadCount ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <IconButton
        component={RouterLink}
        to="/notification-settings"
        aria-label="Obaveštenja"
        sx={{ color: "primary.main", p: 0.75 }}
      >
        <Badge
          variant="dot"
          invisible={unread === 0}
          sx={{
            "& .MuiBadge-badge": {
              bgcolor: "#EF4444",
              width: 9,
              height: 9,
              minWidth: 9,
              borderRadius: "50%",
              top: 3,
              right: 3,
              border: "1.5px solid #F4F7FC",
              boxSizing: "content-box",
            },
          }}
        >
          <NotificationsNoneOutlinedIcon sx={{ fontSize: 28 }} />
        </Badge>
      </IconButton>
      <IconButton
        component={RouterLink}
        to="/profil"
        aria-label="Profil"
        sx={{
          width: 40,
          height: 40,
          bgcolor: "#fff",
          border: "1px solid #E3E9F3",
          color: "primary.main",
          "&:hover": { bgcolor: "#fff" },
        }}
      >
        <PersonOutlineIcon sx={{ fontSize: 24 }} />
      </IconButton>
    </Box>
  );
}

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

  const tourIdForPath = (path: string) => {
    switch (path) {
      case "/":
        return "tour-nav-home";
      case "/create":
        return "tour-nav-create";
      case "/manage-fields":
        return "tour-nav-fields";
      case "/moji-termini":
        return "tour-nav-slots";
      case "/moji-mecevi":
        return "tour-nav-matches";
      case "/moji-igraci":
        return "tour-nav-players";
      case "/notification-settings":
        return "tour-nav-notifications";
      case "/profil":
        return "tour-nav-profile";
      default:
        return undefined;
    }
  };

  // Navigation items with icons
  const getNavItems = () => [
    { 
      label: "Početna", 
      path: "/", 
      show: true,
      icon: <HomeIcon fontSize="small" />
    },
    {
      label: user?.role === "court" ? "Moja mesta" : "Kreiraj Meč",
      path: user?.role === "court" ? "/manage-fields" : "/create",
      show: !!user,
      icon: user?.role === "court" ? <LocationOnIcon fontSize="small" /> : <AddCircleIcon fontSize="small" />
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
      show: !!user,
      icon: <NotificationsIcon fontSize="small" />
    },
    {
      label: "Moj Profil",
      path: "/profil",
      show: !!user,
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
                {user.role === 'court' ? 'Teren' : 'Igrač'}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      {user?.role === 'player' && (
        <Box sx={{ mb: 2, px: 1 }}>
          <NotificationSetupAlert variant="button" />
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
              data-tour={tourIdForPath(item.path)}
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

  const showBottomNav =
    isMobile && user?.role === "player" && BOTTOM_NAV_VISIBLE_PATHS.includes(location.pathname);

  const showCourtBottomNav =
    isMobile && user?.role === "court" && COURT_BOTTOM_NAV_PATHS.includes(location.pathname);

  // Mobile home (player): screenshot-style header (wordmark + bell) + bottom navigation
  if (showBottomNav && location.pathname === "/") {
    return (
      <>
        <MobileHeader showBellDot={user?.notificationEnabled === false} />
        <BottomNav />
      </>
    );
  }

  // Mobile "Moji igrači" (sub-page of Profil): wordmark + invite-a-friend action, bottom navigation
  if (showBottomNav && location.pathname === "/moji-igraci") {
    return (
      <>
        <MobileHeader
          action={
            <IconButton
              aria-label="Pozovi drugara"
              onClick={() => navigate("/profil?sheet=invite")}
              sx={{ color: "text.primary" }}
            >
              <PersonAddAltOutlinedIcon sx={{ fontSize: 28 }} />
            </IconButton>
          }
        />
        <BottomNav />
      </>
    );
  }

  // Mobile "Moji mečevi" / "Obaveštenja" / "Profil": the page has its own header, only the bottom navigation is shown
  if (
    showBottomNav &&
    (location.pathname === "/moji-mecevi" ||
      location.pathname === "/notification-settings" ||
      location.pathname === "/profil")
  ) {
    return <BottomNav />;
  }

  // Court "Moja mesta" / "Moji termini": logo + bell + profile header, court bottom navigation
  if (
    showCourtBottomNav &&
    (location.pathname === "/manage-fields" || location.pathname === "/moji-termini")
  ) {
    return (
      <>
        <MobileHeader action={<CourtHeaderActions />} />
        <BottomNav />
      </>
    );
  }

  // Other court mobile tabs have their own page headers
  if (showCourtBottomNav) {
    return <BottomNav />;
  }

  // Mobile create-match wizard, match details, another player's profile and the login/register screens
  // are full-screen flows with their own top bar
  if (
    isMobile &&
    (location.pathname === "/create" ||
      location.pathname === "/login" ||
      location.pathname === "/register" ||
      location.pathname.startsWith("/matches/") ||
      location.pathname.startsWith("/profil/") ||
      location.pathname === "/notification-settings/postavke")
  ) {
    return null;
  }

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
            position: 'relative',
            minHeight: { xs: 64, sm: 72 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {/* Logo + activate-notifications — left cluster */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mr: "auto",
              zIndex: 1,
              minWidth: 0,
            }}
          >
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              <PlejkoLogo size="sm" />
            </Box>
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
              <NotificationSetupAlert />
            </Box>
          </Box>

          {/* Desktop Navigation */}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              zIndex: 1,
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.label}
                component={RouterLink}
                to={item.path}
                startIcon={item.icon}
                data-tour={tourIdForPath(item.path)}
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
            sx={{ display: { xs: "flex", md: "none" }, zIndex: 1 }}
          >
            <InstallButton />
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              data-tour="tour-nav-menu"
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
      {showBottomNav && <BottomNav />}
    </>
  );
}
