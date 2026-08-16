import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as settingsService from '../services/settingsService';

// Story 6.2/AD-8: applies the active Font Setting's fonts at runtime, on every boot -- this is
// FR-11's "no rebuild/redeploy" mechanism. Structurally separate from Settings.tsx's Preview
// (Task 8): this Context is the ONLY code in the app that ever touches
// document.documentElement's CSS custom properties, and it only does so from a real fetch of
// what's currently Active/curated -- never from a candidate the admin is merely previewing.
interface SiteSettingsContextValue {
  isLoading: boolean;
  refetch: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | undefined>(undefined);

const FONT_PROPERTIES = {
  displayFont: '--font-display',
  bodyFont: '--font-sans',
  monoFont: '--font-mono',
  // Story 6.4: same delivery mechanism as the three font-family properties above, pointed at the
  // one new --root-font-scale custom property (index.css) instead.
  rootFontScale: '--root-font-scale',
} as const;

// Code-review patch (2026-08-16): calls the anonymous GET /settings/effective-fonts endpoint,
// not getSettings()/getFontPairings() (both server-side gated to Master+Support). Those two
// endpoints made this Context 401/403 for every non-admin visitor -- including anonymous
// visitors on the login screen, since SiteSettingsProvider mounts above auth gating -- silently
// swallowed by the try/catch below, so the applied font never reached a real site visitor. The
// backend now resolves the active Setting -> curated pairing server-side and returns just the
// three font-family strings; this Context no longer does that resolution itself.
//
// NFR-4: fail-safe by design -- any failure here (fetch error, network down) simply skips
// setProperty, leaving index.css's hardcoded @theme values in effect. Never throws, never blocks
// app render. The "no active setting" / "unresolvable Value" cases are now handled server-side
// (GetEffectiveFontsAsync itself falls back to hardcoded literals and never throws for those),
// so this Context only needs to guard against the fetch itself failing.
const applyFontPairing = async (): Promise<void> => {
  let fonts: settingsService.EffectiveFontsDto;
  try {
    fonts = await settingsService.getEffectiveFonts();
  } catch (e) {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty(FONT_PROPERTIES.displayFont, fonts.displayFont);
  root.style.setProperty(FONT_PROPERTIES.bodyFont, fonts.bodyFont);
  root.style.setProperty(FONT_PROPERTIES.monoFont, fonts.monoFont);
  root.style.setProperty(FONT_PROPERTIES.rootFontScale, fonts.rootFontScale);
};

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    applyFontPairing().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  // Story 6.2 Task 8: called after a successful Apply so the applying admin's own session
  // reflects the change immediately, without waiting for a full page reload (NFR-1 only requires
  // that for *other* users).
  const refetch = useCallback(() => setRefetchToken((n) => n + 1), []);

  return <SiteSettingsContext.Provider value={{ isLoading, refetch }}>{children}</SiteSettingsContext.Provider>;
};

export const useSiteSettings = (): SiteSettingsContextValue => {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  return ctx;
};
