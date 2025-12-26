import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography
} from '@mui/material';

type RoleSelectionModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (role: 'player' | 'court') => void;
  provider: 'google' | 'facebook' | 'instagram';
};

export default function RoleSelectionModal({ open, onClose, onSelect, provider }: RoleSelectionModalProps) {
  const [role, setRole] = useState<'player' | 'court'>('player');

  const providerNames = {
    google: 'Gmail',
    facebook: 'Facebook',
    instagram: 'Instagram'
  };

  function handleConfirm() {
    onSelect(role);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Izaberite tip naloga
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Pre nego što nastavite sa prijavom preko {providerNames[provider]}, molimo izaberite tip vašeg naloga:
        </Typography>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            Ja sam:
          </FormLabel>
          <RadioGroup
            value={role}
            onChange={(e) => setRole(e.target.value as 'player' | 'court')}
          >
            <FormControlLabel 
              value="player" 
              control={<Radio />} 
              label="Igrač - Tražim terene i mečeve"
            />
            <FormControlLabel 
              value="court" 
              control={<Radio />} 
              label="Teren - Upravljam terenima i rezervacijama"
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Otkaži</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          Nastavi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
