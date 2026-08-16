// Real-backend Settings calls (Story 6.1, backend AD-25/AD-27). Same get/write + fetch pattern
// as services/aiConfigService.ts -- this project has no shared HTTP client wrapper, each service
// file is self-contained. Every route is Master+Support server-side (FeatureKeys.SettingsManage,
// AD-27), unlike aiConfigService's Master-only ai-configuration routes.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Field names/casing mirror the backend's SettingDto exactly (BackEnd Application/Settings/SettingDto.cs).
// createdAt/createdBy are included alongside updatedAt/updatedBy because a seeded-but-never-edited
// row (Story 6.1's initial Font setting) has null updatedAt/updatedBy -- the audit interceptor only
// stamps those on an edit, never on insert.
export interface SettingDto {
  id: string;
  key: string;
  value: string;
  keyType: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

// Story 6.2: the curated catalog a Font Setting's Value must be picked from (AD-26). Field names
// mirror the backend's FontPairingDefinitionDto exactly (BackEnd Application/Settings/
// FontPairingDefinitionDto.cs). DisplayFont/BodyFont/MonoFont are full CSS font-family strings
// (name + fallback stack), passed straight into setProperty/inline style without reformatting.
export interface FontPairingDefinitionDto {
  slug: string;
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  isActive: boolean;
}

// Story 6.4: the curated catalog a FontSize Setting's Value must be picked from, mirroring
// FontPairingDefinitionDto. RootFontScale is a CSS percentage string (e.g. "112%"), passed
// straight into an inline style/setProperty without reformatting -- same convention as the
// font-family fields above.
export interface FontSizeDefinitionDto {
  slug: string;
  rootFontScale: string;
  isActive: boolean;
}

// Story 6.3: a Setting's change history, reverse-chronological. Field names mirror the backend's
// SettingChangeHistoryDto exactly (BackEnd Application/Settings/SettingChangeHistoryDto.cs).
export interface SettingChangeHistoryDto {
  id: string;
  settingId: string;
  key: string;
  keyType: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string | null;
}

// Code-review patch (2026-08-16): the public, anonymous counterpart to SettingDto/
// FontPairingDefinitionDto -- served by GET /api/v1/settings/effective-fonts, the only Settings
// route WITHOUT the SettingsManage server-side gate (see SettingsController.cs's [AllowAnonymous]
// on that one action). Field names mirror the backend's EffectiveFontsDto exactly.
export interface EffectiveFontsDto {
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  rootFontScale: string;
}

// Story 6.5: a curated preset bundling a Font Pairing + Font Size together, for one-click
// selection. Field names mirror the backend's TypographyCombinationDefinitionDto exactly.
// fontPairingSlug/fontSizeSlug are references, resolved client-side against the already-fetched
// FontPairingDefinitionDto[]/FontSizeDefinitionDto[] arrays -- no separate resolution endpoint.
export interface TypographyCombinationDefinitionDto {
  slug: string;
  label: string;
  fontPairingSlug: string;
  fontSizeSlug: string;
  isActive: boolean;
}

// Story 6.5: the two Setting rows applyTypographyCombination updated atomically, mirroring the
// backend's TypographyApplyResultDto.
export interface TypographyApplyResultDto {
  font: SettingDto;
  fontSize: SettingDto;
}

export class SettingsError extends Error {}

const get = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new SettingsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new SettingsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

// Code-review patch (2026-08-16): for genuinely [AllowAnonymous] routes only (today: just
// effective-fonts). get() always attaches an Authorization header even when getToken() is null,
// which the server harmlessly ignores for an anonymous route -- but sending "Bearer null" is a
// live footgun for a future refactor that might read "this call sends a token" as evidence the
// route requires one. This helper omits the header entirely, matching what the route actually is.
const getPublic = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch (e) {
    throw new SettingsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new SettingsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

const write = async <T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new SettingsError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new SettingsError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const getSettings = (): Promise<SettingDto[]> => get('/api/v1/settings');

export const getFontPairings = (): Promise<FontPairingDefinitionDto[]> => get('/api/v1/settings/font-pairings');

export const getFontSizes = (): Promise<FontSizeDefinitionDto[]> => get('/api/v1/settings/font-sizes');

export const applySetting = (id: string, value: string): Promise<SettingDto> =>
  write(`/api/v1/settings/${encodeURIComponent(id)}/apply`, 'PUT', { value });

export const getSettingHistory = (id: string): Promise<SettingChangeHistoryDto[]> =>
  get(`/api/v1/settings/${encodeURIComponent(id)}/history`);

// Code-review patch (2026-08-16): what SiteSettingsContext calls now, instead of getSettings() +
// getFontPairings() (both server-side gated to Master+Support -- the bug this patch fixes: every
// non-admin visitor got 401/403 from those two, silently swallowed by the fail-safe catch, so the
// site-wide font never actually reached a real user). Uses getPublic() (2026-08-16, second pass),
// not get() -- this route is genuinely anonymous server-side, so it shouldn't send an Authorization
// header at all, "Bearer null" included, even though the server harmlessly ignores it today.
export const getEffectiveFonts = (): Promise<EffectiveFontsDto> => getPublic('/api/v1/settings/effective-fonts');

// Story 6.5: admin-gated (SettingsManage), unlike effective-fonts -- uses get()/write(), not
// getPublic().
export const getTypographyCombinations = (): Promise<TypographyCombinationDefinitionDto[]> =>
  get('/api/v1/settings/typography-combinations');

export const applyTypographyCombination = (slug: string): Promise<TypographyApplyResultDto> =>
  write(`/api/v1/settings/typography-combinations/${encodeURIComponent(slug)}/apply`, 'PUT', {});

// The Advanced composer's save: a font pairing + size scale chosen independently, applied together.
// Deliberately NOT two applySetting calls -- the backend writes both Settings in one transaction, so
// a failure can't leave the site on the new font at the old size (see SettingsService.ApplyTypographyAsync).
export const applyTypography = (fontPairingSlug: string, fontSizeSlug: string): Promise<TypographyApplyResultDto> =>
  write('/api/v1/settings/typography/apply', 'PUT', { fontPairingSlug, fontSizeSlug });
