'use client';

import type { ReactNode } from 'react';
import { Box, ButtonBase } from '@mui/material';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  'data-tour'?: string;
};

/** Two/three-way segmented control: white track, thin border, solid blue active pill. */
export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'data-tour': dataTour,
}: SegmentedControlProps<T>) {
  return (
    <Box
      role="group"
      data-tour={dataTour}
      sx={{
        display: 'flex',
        width: '100%',
        p: '3px',
        gap: '2px',
        bgcolor: '#FFFFFF',
        border: '1px solid',
        borderColor: '#DCE5F2',
        borderRadius: '12px',
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <ButtonBase
            key={opt.value}
            aria-pressed={selected}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            sx={{
              flex: 1,
              height: 38,
              borderRadius: '9px',
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1,
              color: selected ? '#FFFFFF' : '#0B1B3F',
              bgcolor: selected ? 'primary.main' : 'transparent',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {opt.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
