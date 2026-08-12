import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Paper,
} from '@mui/material';
import SportsIcon from '@mui/icons-material/Sports';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

type RoleSelectionModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (role: 'player' | 'court') => void;
  provider: 'google' | 'facebook' | 'instagram';
};

export default function RoleSelectionModal({ open, onClose, onSelect, provider }: RoleSelectionModalProps) {
  const [role, setRole] = useState<'player' | 'court'>('player');

  const providerNames = {
    google: 'Google',
    facebook: 'Facebook',
    instagram: 'Instagram'
  };

  function handleConfirm() {
    onSelect(role);
    onClose();
  }

  const roleOptions = [
    {
      value: 'player' as const,
      icon: <SportsIcon sx={{ fontSize: 28 }} />,
      title: 'Igrač',
      description: 'Tražim terene i mečeve',
    },
    {
      value: 'court' as const,
      icon: <LocationOnIcon sx={{ fontSize: 28 }} />,
      title: 'Vlasnik terena',
      description: 'Upravljam terenima i rezervacijama',
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 2 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <PersonIcon sx={{ color: 'white', fontSize: 28 }} />
        </Box>
        <Typography variant="h5" fontWeight={700}>
          Izaberite tip naloga
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            mb: 3,
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          Pre nego što nastavite sa {providerNames[provider]}, molimo izaberite kako ćete koristiti Plejko
        </Typography>

        <Stack spacing={2}>
          {roleOptions.map((option) => (
            <Paper
              key={option.value}
              onClick={() => setRole(option.value)}
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '2px solid',
                borderColor: role === option.value ? 'primary.main' : 'divider',
                bgcolor: role === option.value ? 'primary.main' : 'background.paper',
                color: role === option.value ? 'primary.contrastText' : 'text.primary',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: role === option.value ? 'rgba(255,255,255,0.2)' : 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {option.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {option.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: role === option.value ? 'rgba(255,255,255,0.8)' : 'text.secondary',
                    }}
                  >
                    {option.description}
                  </Typography>
                </Box>
                {role === option.value && (
                  <CheckCircleIcon sx={{ color: 'white' }} />
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          alignItems: 'stretch',
          gap: 1.5,
          '& > :not(:first-of-type)': { ml: { xs: 0, sm: 1 } },
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          fullWidth
          size="large"
          sx={{
            borderRadius: 3,
          }}
        >
          Otkaži
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          fullWidth
          size="large"
          sx={{
            borderRadius: 3,
          }}
        >
          Nastavi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
