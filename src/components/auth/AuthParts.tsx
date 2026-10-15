'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

/** Height shared by auth inputs and primary buttons (reference: 52px, radius 14). */
export const AUTH_CONTROL_HEIGHT = 52;

type AuthShellProps = {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  /** Dots shown top-right, e.g. register steps. */
  progress?: { total: number; current: number };
  maxWidth?: number;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Full-screen auth layout used by /login and /register:
 * back chevron (+ optional progress dots), left-aligned heading, content and footer.
 * On desktop the content is shown in a centered card.
 */
export function AuthShell({
  title,
  subtitle,
  onBack,
  progress,
  maxWidth = 440,
  children,
  footer,
}: AuthShellProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth,
        mx: 'auto',
        px: { xs: '14px', md: '40px' },
        py: { xs: '4px', md: '36px' },
        my: { md: 3 },
        bgcolor: { xs: 'transparent', md: 'background.paper' },
        border: { xs: 'none', md: '1px solid' },
        borderColor: { md: 'divider' },
        borderRadius: { md: '20px' },
        minHeight: { xs: 'calc(100dvh - 24px)', md: 'auto' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          mb: '14px',
          mx: '-8px',
        }}
      >
        {onBack ? (
          <IconButton aria-label="Nazad" onClick={onBack} sx={{ color: 'text.primary' }}>
            <ChevronLeftIcon sx={{ fontSize: 32 }} />
          </IconButton>
        ) : (
          <span />
        )}
        {progress && progress.total > 0 && (
          <Box
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={progress.total}
            aria-valuenow={progress.current}
            sx={{ display: 'flex', gap: '10px', pr: '8px' }}
          >
            {Array.from({ length: progress.total }, (_, i) => (
              <Box
                key={i}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: i + 1 === progress.current ? 'primary.main' : 'divider',
                  transition: 'background-color .2s',
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      <Typography
        component="h1"
        sx={{ fontSize: 28, lineHeight: '34px', fontWeight: 800, letterSpacing: '-0.02em' }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          sx={{ mt: '8px', fontSize: 15, lineHeight: '22px', color: 'text.secondary', fontWeight: 400 }}
        >
          {subtitle}
        </Typography>
      )}

      <Box sx={{ mt: '26px', flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>

      {footer && <Box sx={{ mt: '28px', mb: '8px', textAlign: 'center' }}>{footer}</Box>}
    </Box>
  );
}

type AuthFieldProps = Omit<TextFieldProps, 'variant' | 'label'> & {
  label: string;
  icon: ReactNode;
  /** Adds a show/hide toggle (field must be type="password"). */
  passwordToggle?: boolean;
};

/** Text field with the label above the input, leading icon and 52px rounded control. */
export const AuthField = forwardRef<HTMLDivElement, AuthFieldProps>(function AuthField(
  { label, icon, passwordToggle, type, sx, InputProps, id, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? `auth-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Box ref={ref}>
      <Typography
        component="label"
        htmlFor={inputId}
        sx={{ display: 'block', mb: '8px', fontSize: 14, fontWeight: 600, color: 'text.primary' }}
      >
        {label}
      </Typography>
      <TextField
        {...rest}
        id={inputId}
        fullWidth
        variant="outlined"
        type={passwordToggle ? (visible ? 'text' : 'password') : type}
        InputProps={{
          ...InputProps,
          startAdornment: (
            <InputAdornment position="start" sx={{ color: 'text.secondary', mr: '10px' }}>
              {icon}
            </InputAdornment>
          ),
          endAdornment: passwordToggle ? (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={visible ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                onClick={() => setVisible((v) => !v)}
                sx={{ color: 'text.secondary' }}
              >
                {visible ? (
                  <VisibilityOffOutlinedIcon sx={{ fontSize: 22 }} />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </InputAdornment>
          ) : (
            InputProps?.endAdornment
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            height: AUTH_CONTROL_HEIGHT,
            borderRadius: '14px',
            bgcolor: 'background.paper',
            pl: '16px',
            pr: '12px',
            fontSize: 15,
            '& fieldset': { borderWidth: '1px', borderColor: 'divider' },
            '&:hover fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.5) },
            '&.Mui-focused fieldset': { borderWidth: '1.5px', borderColor: 'primary.main' },
            '& input::placeholder': { color: 'text.secondary', opacity: 0.75 },
          },
          '& .MuiFormHelperText-root': { mx: '4px', mt: '6px', fontSize: 12.5 },
          ...(sx as object),
        }}
      />
    </Box>
  );
});

/** Multi-colour Google "G" (the MUI icon is monochrome). */
export function GoogleColorIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type SocialButtonProps = {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

/** White bordered provider button ("Nastavi sa Google nalogom"). */
export function SocialButton({ icon, children, onClick, disabled }: SocialButtonProps) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: '100%',
        height: AUTH_CONTROL_HEIGHT,
        borderRadius: '14px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        fontSize: 15,
        fontWeight: 600,
        color: 'text.primary',
        fontFamily: 'inherit',
        '&.Mui-disabled': { opacity: 0.6 },
        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
      }}
    >
      {icon}
      {children}
    </ButtonBase>
  );
}

/** "ili" separator with hairlines. */
export function OrDivider() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', my: '22px' }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <Typography sx={{ fontSize: 14, color: 'text.secondary', fontWeight: 400 }}>ili</Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Box>
  );
}
