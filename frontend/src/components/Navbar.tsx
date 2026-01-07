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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InstallButton from "./InstallButton";

// Import logo
import playmatchLogo from "../assets/logo2.png";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const navItems = [
    { label: "Početna", path: "/", show: true },
    {
      label: user?.role === "court" ? "Moji Tereni" : "Kreiraj Meč",
      path: user?.role === "court" ? "/manage-fields" : "/create",
      show: !!user,
    },
    {
      label: "Moji Termini",
      path: "/moji-termini",
      show: !!user && user?.role === "court",
    },
    {
      label: "Moj Profil",
      path: "/profil",
      show: !!user && user?.role === "player",
    },
    { label: "Prijava", path: "/login", show: !user },
    { label: "Registracija", path: "/register", show: !user },
  ];

  const drawer = (
    <Box sx={{ textAlign: "center", pt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        PlayMatch Global
      </Typography>
      <List onClick={handleDrawerToggle}>
        {navItems
          .filter((item) => item.show)
          .map((item) => (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                sx={{ textAlign: "center" }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        {user && (
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={{ textAlign: "center" }}>
              <ListItemText primary="Odjavi se" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: "#2e7d32" }}>
        <Toolbar
          sx={{
            minHeight: { xs: 48, sm: 64 },
            px: { xs: 1, sm: 2 },
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* LOGO LEVO */}
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <Box
              component="img"
              src={playmatchLogo}
              alt="PlayMatch logo"
              sx={{
                height: 80,
                width: "auto",
                cursor: "pointer",
                mr: 1,
              }}
            />
          </Box>

          {/* Desktop navigacija */}
          <Stack
            direction="row"
            spacing={2}
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
            }}
          >
            <Button color="inherit" component={RouterLink} to="/">
              Početna
            </Button>

            {user?.role === "court" ? (
              <>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/manage-fields"
                >
                  Moji Tereni
                </Button>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/moji-termini"
                >
                  Moji Termini
                </Button>
              </>
            ) : user ? (
              <>
                <Button color="inherit" component={RouterLink} to="/create">
                  Kreiraj Meč
                </Button>
                <Button color="inherit" component={RouterLink} to="/profil">
                  Moj Profil
                </Button>
              </>
            ) : null}

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

          {/* Install dugme i hamburger meni na mobilnom */}
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
              edge="end"
              onClick={handleDrawerToggle}
              sx={{
                pr: 2,
                mr: 1,
              }}
            >
              <MenuIcon sx={{ fontSize: 32 }} />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* DRAWER */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: 280 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
