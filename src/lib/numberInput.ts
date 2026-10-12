import type { FocusEvent } from 'react';

/** Select the whole value so the next keystroke replaces instead of appending. */
export function selectNumberField(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  const input = event.target;
  requestAnimationFrame(() => input.select());
}

/** Empty string, a finite number, or `null` when the keystroke should be ignored. */
export function parseNumberInput(raw: string): number | '' | null {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function parseIntegerInput(raw: string): number | '' | null {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (!/^\d+$/.test(trimmed)) return null;
  return parseInt(trimmed, 10);
}

export function toNumberOr(value: number | '', fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
