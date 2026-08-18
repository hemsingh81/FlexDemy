import type { FontPairingDefinitionDto } from '../../../services/settingsService';

// Code-review patch (2026-08-16): guards against an unparseable date string rendering the literal
// text "Invalid Date" -- falls back to an em dash instead. Shared by ChangeHistory.tsx and
// Settings.tsx's own generic per-KeyType rendering.
export const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

// '"Playfair Display", Georgia, serif' -> 'Playfair Display'. Lets every label in this screen read
// as the font's actual name instead of an internal slug ("academic"), without adding a display-name
// column to FontPairingDefinition -- the name is already in the CSS font-family string the backend
// sends. Falls back to the raw string if it somehow has no leading family.
export const primaryFontName = (cssFontFamily: string): string => {
  const first = cssFontFamily.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '') || cssFontFamily;
};

// "Fraunces + Outfit" for a two-family pairing, just "Atkinson Hyperlegible" when display and body
// are the same family (the Accessible pairing) -- "X + X" reads like a mistake. Shared by
// TypographyComposer.tsx, ThemeCard.tsx, and AppearanceSection.tsx.
export const pairingLabel = (pairing: FontPairingDefinitionDto): string => {
  const display = primaryFontName(pairing.displayFont);
  const body = primaryFontName(pairing.bodyFont);
  return display === body ? display : `${display} + ${body}`;
};
