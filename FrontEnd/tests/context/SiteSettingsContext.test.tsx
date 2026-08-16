import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteSettingsProvider, useSiteSettings } from '@/src/context/SiteSettingsContext';
import * as settingsService from '@/src/services/settingsService';

// Code-review patch (2026-08-16): mocks getEffectiveFonts, not getSettings/getFontPairings --
// the Context now calls the single anonymous /settings/effective-fonts endpoint, which resolves
// the active Setting -> curated pairing server-side. The "no active setting" / "unresolvable
// slug" branches moved server-side too (see SettingsServiceTests.GetEffectiveFontsAsync_falls_
// back_to_hardcoded_literals_*) -- this file only needs to cover what the Context itself still
// controls: apply on a successful fetch, skip on a failed one.
vi.mock('@/src/services/settingsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/settingsService')>('@/src/services/settingsService');
  return { ...actual, getEffectiveFonts: vi.fn() };
});

// Exposes isLoading so tests can deterministically wait for the boot fetch to settle before
// asserting on document.documentElement, rather than racing an arbitrary waitFor.
const Probe: React.FC = () => {
  const { isLoading } = useSiteSettings();
  return <div data-testid="probe">{isLoading ? 'loading' : 'done'}</div>;
};

describe('SiteSettingsContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.documentElement.style.removeProperty('--font-display');
    document.documentElement.style.removeProperty('--font-sans');
    document.documentElement.style.removeProperty('--font-mono');
    document.documentElement.style.removeProperty('--root-font-scale');
  });

  it('applies the resolved fonts and root font scale to document.documentElement on a successful fetch', async () => {
    vi.mocked(settingsService.getEffectiveFonts).mockResolvedValue({
      displayFont: '"Lora", serif',
      bodyFont: '"Inter", sans-serif',
      monoFont: '"Fira Code", monospace',
      rootFontScale: '112%',
    });

    render(
      <SiteSettingsProvider>
        <Probe />
      </SiteSettingsProvider>
    );
    await screen.findByText('done');

    expect(document.documentElement.style.getPropertyValue('--font-display')).toBe('"Lora", serif');
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe('"Inter", sans-serif');
    expect(document.documentElement.style.getPropertyValue('--font-mono')).toBe('"Fira Code", monospace');
    expect(document.documentElement.style.getPropertyValue('--root-font-scale')).toBe('112%');
  });

  it('does not touch document.documentElement when the fetch fails', async () => {
    vi.mocked(settingsService.getEffectiveFonts).mockRejectedValue(new settingsService.SettingsError('Could not reach the server.'));

    render(
      <SiteSettingsProvider>
        <Probe />
      </SiteSettingsProvider>
    );
    await screen.findByText('done');

    expect(document.documentElement.style.getPropertyValue('--font-display')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--root-font-scale')).toBe('');
  });
});
