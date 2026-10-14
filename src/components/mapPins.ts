import L from 'leaflet';
import { GAME_TYPES } from '../constants/games';

/** SVG path data of the Material icons used inside map pins (viewBox 0 0 24 24). */
const GLYPHS: Record<string, string[]> = {
  soccer: ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34M7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21"],
  basketball: ["M17.09 11h4.86c-.16-1.61-.71-3.11-1.54-4.4-1.73.83-2.99 2.45-3.32 4.4M6.91 11c-.33-1.95-1.59-3.57-3.32-4.4-.83 1.29-1.38 2.79-1.54 4.4zm8.16 0c.32-2.59 1.88-4.79 4.06-6-1.6-1.63-3.74-2.71-6.13-2.95V11zm-6.14 0H11V2.05C8.61 2.29 6.46 3.37 4.87 5c2.18 1.21 3.74 3.41 4.06 6m6.14 2H13v8.95c2.39-.24 4.54-1.32 6.13-2.95-2.18-1.21-3.74-3.41-4.06-6M3.59 17.4c1.72-.83 2.99-2.46 3.32-4.4H2.05c.16 1.61.71 3.11 1.54 4.4m13.5-4.4c.33 1.95 1.59 3.57 3.32 4.4.83-1.29 1.38-2.79 1.54-4.4zm-8.16 0c-.32 2.59-1.88 4.79-4.06 6 1.6 1.63 3.74 2.71 6.13 2.95V13z"],
  tennis: ["M19.52 2.49C17.18.15 12.9.62 9.97 3.55c-1.6 1.6-2.52 3.87-2.54 5.46-.02 1.58.26 3.89-1.35 5.5l-4.24 4.24 1.42 1.42 4.24-4.24c1.61-1.61 3.92-1.33 5.5-1.35s3.86-.94 5.46-2.54c2.92-2.93 3.4-7.21 1.06-9.55m-9.2 9.19c-1.53-1.53-1.05-4.61 1.06-6.72s5.18-2.59 6.72-1.06c1.53 1.53 1.05 4.61-1.06 6.72s-5.18 2.59-6.72 1.06M18 17c.53 0 1.04.21 1.41.59.78.78.78 2.05 0 2.83-.37.37-.88.58-1.41.58s-1.04-.21-1.41-.59c-.78-.78-.78-2.05 0-2.83.37-.37.88-.58 1.41-.58m0-2c-1.02 0-2.05.39-2.83 1.17-1.56 1.56-1.56 4.09 0 5.66.78.78 1.81 1.17 2.83 1.17s2.05-.39 2.83-1.17c1.56-1.56 1.56-4.09 0-5.66C20.05 15.39 19.02 15 18 15"],
  volleyball: ["M6 4.01C3.58 5.84 2 8.73 2 12c0 1.46.32 2.85.89 4.11L6 14.31zm5 7.41V2.05c-1.06.11-2.07.38-3 .79v10.32zm1 1.73-8.11 4.68c.61.84 1.34 1.59 2.18 2.2L15 14.89zm1-5.19v3.46l8.11 4.68c.42-.93.7-1.93.82-2.98zM8.07 21.2c1.21.51 2.53.8 3.93.8 3.34 0 6.29-1.65 8.11-4.16L17 16.04zm13.85-10.39c-.55-4.63-4.26-8.3-8.92-8.76v3.6z"],
  handball: ["M14.27 6c-.55.95-.22 2.18.73 2.73s2.18.22 2.73-.73.22-2.18-.73-2.73-2.18-.22-2.73.73","M15.84 10.41s-1.63-.94-2.6-1.5c-2.38-1.38-3.2-4.44-1.82-6.82l-1.73-1C8.1 3.83 8.6 7.21 10.66 9.4l-5.15 8.92 1.73 1 1.5-2.6 1.73 1-3 5.2 1.73 1 6.29-10.89c1.14 1.55 1.33 3.69.31 5.46l1.73 1c1.6-2.75 1.28-6.58-1.69-9.08","M12.75 3.8c.72.41 1.63.17 2.05-.55.41-.72.17-1.63-.55-2.05-.72-.41-1.63-.17-2.05.55-.41.72-.17 1.64.55 2.05"],
  score: ["M11 6H9V4h2zm4-2h-2v2h2zM9 14h2v-2H9zm10-4V8h-2v2zm0 4v-2h-2v2zm-6 0h2v-2h-2zm6-10h-2v2h2zm-6 4V6h-2v2zm-6 2V8h2V6H7V4H5v16h2v-8h2v-2zm8 2h2v-2h-2zm-4-2v2h2v-2zM9 8v2h2V8zm4 2h2V8h-2zm2-4v2h2V6z"],
  casino: ["M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18m0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9m4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9"],
  bar: ["M19 9h-1.56c.35-.59.56-1.27.56-2 0-2.21-1.79-4-4-4-.34 0-.66.05-.98.13-.82-.68-1.86-1.11-3.02-1.11-1.89 0-3.51 1.11-4.27 2.71C4.15 5.26 3 6.74 3 8.5c0 1.86 1.28 3.41 3 3.86V21h11v-2h2c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2M7 10.5c-1.1 0-2-.9-2-2 0-.85.55-1.6 1.37-1.88l.8-.27.36-.76C8 4.62 8.94 4.02 10 4.02c.79 0 1.39.35 1.74.65l.78.65S13.16 5 13.99 5c1.1 0 2 .9 2 2h-3C9.67 7 9.15 10.5 7 10.5M19 17h-2v-6h2z"],
  esports: ["m21.58 16.09-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91M11 11H9v2H8v-2H6v-1h2V8h1v2h2zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1"],
  place: ["M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5"],
};

type PinStyle = { color: string; glyph: keyof typeof GLYPHS; glyphColor?: string };

const BY_SPORT: Record<string, PinStyle> = {
  football: { color: '#0877F9', glyph: 'soccer', glyphColor: '#111827' },
  football_11: { color: '#0877F9', glyph: 'soccer', glyphColor: '#111827' },
  basketball: { color: '#F97316', glyph: 'basketball' },
  basketball_3x3: { color: '#F97316', glyph: 'basketball' },
  nba2k: { color: '#F97316', glyph: 'basketball' },
  padel: { color: '#22A559', glyph: 'tennis' },
  tennis: { color: '#22A559', glyph: 'tennis' },
  squash: { color: '#22A559', glyph: 'tennis' },
  badminton: { color: '#22A559', glyph: 'tennis' },
  table_tennis: { color: '#22A559', glyph: 'tennis' },
  volleyball: { color: '#F59E0B', glyph: 'volleyball' },
  beach_volleyball: { color: '#F59E0B', glyph: 'volleyball' },
  handball: { color: '#0877F9', glyph: 'handball' },
};

const BY_CATEGORY: Record<string, PinStyle> = {
  sport: { color: '#0877F9', glyph: 'score' },
  tabletop: { color: '#7C3AED', glyph: 'casino' },
  pub: { color: '#F97316', glyph: 'bar' },
  esports: { color: '#7C3AED', glyph: 'esports' },
};

const cache = new Map<string, L.DivIcon>();

function buildPin(style: PinStyle, width: number, height: number, key: string): L.DivIcon {
  const cached = cache.get(key);
  if (cached) return cached;

  const glyphSize = Math.round(width * 0.42);
  const glyphLeft = Math.round(width * 0.5 - glyphSize / 2);
  const glyphTop = Math.round(height * (17.5 / 46) - glyphSize / 2);
  const paths = GLYPHS[style.glyph]
    .map((d) => `<path d="${d}" fill="${style.glyphColor ?? style.color}"/>`)
    .join('');

  const html = `
    <div style="position:relative;width:${width}px;height:${height}px;filter:drop-shadow(0 2px 4px rgba(11,27,63,0.28));">
      <svg width="${width}" height="${height}" viewBox="0 0 36 46" style="display:block">
        <path d="M18 45C18 45 2 28.5 2 17.5a16 16 0 0 1 32 0C34 28.5 18 45 18 45z" fill="${style.color}" stroke="#fff" stroke-width="2"/>
        <circle cx="18" cy="17.5" r="10.5" fill="#fff"/>
      </svg>
      <svg width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24" style="position:absolute;left:${glyphLeft}px;top:${glyphTop}px">${paths}</svg>
    </div>`;

  const icon = L.divIcon({
    className: 'plejko-pin',
    html,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
  cache.set(key, icon);
  return icon;
}

/** Map pin for a match location — color and glyph depend on the sport; larger when selected. */
export function createSportPin(sport: string, selected = false): L.DivIcon {
  const style =
    BY_SPORT[sport] ?? BY_CATEGORY[GAME_TYPES[sport]?.category ?? 'sport'] ?? BY_CATEGORY.sport;
  const [w, h] = selected ? [44, 56] : [34, 43];
  return buildPin(style, w, h, `${sport}:${selected}`);
}

/** Smaller neutral pin for fields (courts) without a selected match. */
export function createFieldPin(): L.DivIcon {
  return buildPin({ color: '#64748B', glyph: 'place' }, 26, 33, 'field');
}
