import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from '@/src/features/Admin/Settings/Settings';
import * as settingsService from '@/src/services/settingsService';

vi.mock('@/src/services/settingsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/settingsService')>('@/src/services/settingsService');
  return {
    ...actual,
    getSettings: vi.fn(),
    getFontPairings: vi.fn(),
    getFontSizes: vi.fn(),
    getTypographyCombinations: vi.fn(),
    applyTypographyCombination: vi.fn(),
    applyTypography: vi.fn(),
    getSettingHistory: vi.fn(),
  };
});

const mockRefetch = vi.fn();
vi.mock('@/src/context/SiteSettingsContext', () => ({
  useSiteSettings: () => ({ isLoading: false, refetch: mockRefetch }),
}));

// ToastContext is deliberately NOT mocked: its createContext default is a no-op showToast, so a
// component calling useToast() outside a ToastProvider is a supported case by design (see
// ToastContext.tsx). Rendering Settings bare here exercises that path rather than papering over it.

const SETTINGS: settingsService.SettingDto[] = [
  {
    id: 'setting_font',
    key: 'font.pairing',
    value: 'default',
    keyType: 'Font',
    isActive: true,
    createdAt: '2026-08-15T10:00:00Z',
    createdBy: null,
    // Never-edited seeded row -- updatedAt/updatedBy are null, proving the createdAt/createdBy
    // fallback actually renders something (Story 6.1).
    updatedAt: null,
    updatedBy: null,
  },
  {
    id: 'setting_logo',
    key: 'logo.url',
    value: '/logo.svg',
    keyType: 'Branding',
    isActive: false,
    createdAt: '2026-08-10T10:00:00Z',
    createdBy: 'admin_1',
    updatedAt: '2026-08-14T09:30:00Z',
    updatedBy: 'admin_2',
  },
  {
    id: 'setting_font_size',
    key: 'font.size',
    value: 'default',
    keyType: 'FontSize',
    isActive: true,
    createdAt: '2026-08-16T10:00:00Z',
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  },
];

// 'accessible' deliberately uses ONE family for both display and body -- exercises pairingLabel's
// "don't render 'X + X'" branch, which the real seeded Accessible pairing (Atkinson Hyperlegible
// for both) actually hits.
const FONT_PAIRINGS: settingsService.FontPairingDefinitionDto[] = [
  { slug: 'default', displayFont: '"Fraunces", Georgia, serif', bodyFont: '"Outfit", system-ui, sans-serif', monoFont: '"JetBrains Mono", monospace', isActive: true },
  { slug: 'warm-editorial', displayFont: '"Lora", serif', bodyFont: '"Inter", sans-serif', monoFont: '"Fira Code", monospace', isActive: true },
  { slug: 'accessible', displayFont: '"Atkinson Hyperlegible", system-ui, sans-serif', bodyFont: '"Atkinson Hyperlegible", system-ui, sans-serif', monoFont: '"JetBrains Mono", monospace', isActive: true },
];

const FONT_SIZES: settingsService.FontSizeDefinitionDto[] = [
  { slug: 'default', rootFontScale: '100%', isActive: true },
  { slug: 'compact', rootFontScale: '90%', isActive: true },
  { slug: 'comfortable', rootFontScale: '112%', isActive: true },
  { slug: 'large', rootFontScale: '125%', isActive: true },
  { slug: 'presentation', rootFontScale: '140%', isActive: true },
];

// Mirrors the real seed's shape: themes that vary by FONT PAIRING as well as size, not five
// same-font size variants (the state that made every preset card render identically before real
// pairings were curated).
const TYPOGRAPHY_COMBINATIONS: settingsService.TypographyCombinationDefinitionDto[] = [
  { slug: 'default', label: 'Default', fontPairingSlug: 'default', fontSizeSlug: 'default', isActive: true },
  { slug: 'compact', label: 'Compact', fontPairingSlug: 'default', fontSizeSlug: 'compact', isActive: true },
  { slug: 'academic', label: 'Academic', fontPairingSlug: 'warm-editorial', fontSizeSlug: 'comfortable', isActive: true },
  { slug: 'accessible', label: 'Accessible', fontPairingSlug: 'accessible', fontSizeSlug: 'large', isActive: true },
  { slug: 'presentation', label: 'Presentation', fontPairingSlug: 'default', fontSizeSlug: 'presentation', isActive: true },
];

const HISTORY: settingsService.SettingChangeHistoryDto[] = [
  {
    id: 'history_2',
    settingId: 'setting_font',
    key: 'font.pairing',
    keyType: 'Font',
    oldValue: 'default',
    newValue: 'warm-editorial',
    changedAt: '2026-08-15T12:00:00Z',
    changedBy: 'admin_1',
  },
  {
    id: 'history_1',
    settingId: 'setting_font',
    key: 'font.pairing',
    keyType: 'Font',
    oldValue: 'discontinued-pairing',
    newValue: 'default',
    changedAt: '2026-08-14T09:00:00Z',
    changedBy: null,
  },
];

const SIZE_HISTORY: settingsService.SettingChangeHistoryDto[] = [
  {
    id: 'size_history_1',
    settingId: 'setting_font_size',
    key: 'font.size',
    keyType: 'FontSize',
    oldValue: 'default',
    newValue: 'comfortable',
    changedAt: '2026-08-15T16:00:00Z',
    changedBy: 'admin_1',
  },
];

// newValue matches no slug in FONT_PAIRINGS -- exercises the "no longer curated" path.
const HISTORY_WITH_DECURATED_ENTRY: settingsService.SettingChangeHistoryDto[] = [
  {
    id: 'history_3',
    settingId: 'setting_font',
    key: 'font.pairing',
    keyType: 'Font',
    oldValue: 'default',
    newValue: 'retired-pairing',
    changedAt: '2026-08-15T12:00:00Z',
    changedBy: 'admin_1',
  },
];

// The custom font/size pickers and change history live under one collapsed-by-default "Advanced"
// disclosure -- any test reaching either picker must open it first, or the combobox simply isn't
// in the DOM yet.
const openAdvanced = async () => {
  const section = await screen.findByTestId('settings-typography-section');
  fireEvent.click(within(section).getByRole('button', { name: /^advanced$/i }));
  return section;
};

// Theme cards are <button>s labelled by intent, so a click target is addressed the way a user
// would describe it rather than by test id.
const themeCard = (section: HTMLElement, label: string) =>
  within(section).getByRole('button', { name: new RegExp(`apply the ${label} theme`, 'i') });

describe('Settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(settingsService.getSettings).mockResolvedValue(structuredClone(SETTINGS));
    vi.mocked(settingsService.getFontPairings).mockResolvedValue(structuredClone(FONT_PAIRINGS));
    vi.mocked(settingsService.getFontSizes).mockResolvedValue(structuredClone(FONT_SIZES));
    vi.mocked(settingsService.getTypographyCombinations).mockResolvedValue(structuredClone(TYPOGRAPHY_COMBINATIONS));
    vi.mocked(settingsService.getSettingHistory).mockResolvedValue([]);
  });

  it('renders settings grouped by KeyType, one section per group -- Font/FontSize combined into Appearance', async () => {
    render(<Settings />);

    await screen.findByTestId('settings-typography-section');
    expect(screen.getByTestId('settings-branding-section')).toBeInTheDocument();
  });

  it('keeps raw setting internals out of the Appearance section, but still renders them for other KeyTypes', async () => {
    render(<Settings />);

    // The Appearance section is a theme picker, not a data dump: internal keys, raw stored values
    // and actor ids are what the redesign deliberately removed from this surface (they remain
    // available under Advanced -> history).
    const appearance = await screen.findByTestId('settings-typography-section');
    expect(within(appearance).queryByText('font.pairing')).not.toBeInTheDocument();
    expect(within(appearance).queryByText(/Value: default/)).not.toBeInTheDocument();
    expect(within(appearance).queryByText(/Last changed/)).not.toBeInTheDocument();

    // Every other KeyType still renders through the generic per-setting rows, unchanged.
    const branding = screen.getByTestId('settings-branding-section');
    expect(within(branding).getByText('logo.url')).toBeInTheDocument();
    expect(within(branding).getByText(/Value: \/logo.svg/)).toBeInTheDocument();
    expect(within(branding).getByText('Inactive')).toBeInTheDocument();
  });

  it('summarises what is live as a theme name plus resolved font and scale', async () => {
    render(<Settings />);

    // Scoped to the summary: the resolved theme name also appears as its card's title, so an
    // unscoped getByText would ambiguously match both.
    const summary = await screen.findByTestId('appearance-summary');
    // SETTINGS seeds font.pairing="default" + font.size="default", which is exactly the Default theme.
    expect(within(summary).getByText('Default')).toBeInTheDocument();
    expect(within(summary).getByText(/Fraunces \+ Outfit · 100% text size/)).toBeInTheDocument();
  });

  it('reports a font/size mix matching no curated theme as Custom rather than showing nothing as current', async () => {
    // warm-editorial + presentation is not one of the seeded combos.
    vi.mocked(settingsService.getSettings).mockResolvedValue(
      structuredClone(SETTINGS).map((s) =>
        s.keyType === 'Font' ? { ...s, value: 'warm-editorial' } : s.keyType === 'FontSize' ? { ...s, value: 'presentation' } : s,
      ),
    );

    render(<Settings />);

    const section = await screen.findByTestId('settings-typography-section');
    expect(within(section).getByText('Custom')).toBeInTheDocument();
    expect(within(section).getByText(/Lora \+ Inter · 140% text size/)).toBeInTheDocument();
  });

  it('displays updatedBy when present, not createdBy', async () => {
    render(<Settings />);

    const brandingSection = await screen.findByTestId('settings-branding-section');
    expect(within(brandingSection).getByText(/by admin_2/)).toBeInTheDocument();
  });

  it('shows a friendly error instead of a blank page when the fetch fails', async () => {
    vi.mocked(settingsService.getSettings).mockRejectedValue(new settingsService.SettingsError('Could not reach the server. Please try again.'));

    render(<Settings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.');
  });

  // -- Theme cards ---------------------------------------------------------------------------

  it('renders exactly one card per curated theme', async () => {
    // A hard count, not a lower bound -- a loose assertion wouldn't catch a spurious/duplicate
    // combo leaking through GetTypographyCombinationsAsync's filtering.
    render(<Settings />);

    const section = await screen.findByTestId('settings-typography-section');
    const cards = within(within(section).getByRole('group', { name: /themes/i })).getAllByRole('button');
    expect(cards).toHaveLength(TYPOGRAPHY_COMBINATIONS.length);
  });

  it('each card previews itself in its own pairing and scale, so cards are visually distinguishable', async () => {
    render(<Settings />);

    const section = await screen.findByTestId('settings-typography-section');

    const academic = themeCard(section, 'Academic');
    expect(within(academic).getByText('Sample Heading')).toHaveStyle({ fontFamily: '"Lora", serif' });
    expect(within(academic).getByText(/Lora \+ Inter/)).toBeInTheDocument();
    expect(within(academic).getByText(/112% text size/)).toBeInTheDocument();

    // A different theme resolves to genuinely different fonts -- the regression that made every
    // card render identically was invisible to any single-card assertion.
    const presentation = themeCard(section, 'Presentation');
    expect(within(presentation).getByText('Sample Heading')).toHaveStyle({ fontFamily: '"Fraunces", Georgia, serif' });
    expect(within(presentation).getByText(/140% text size/)).toBeInTheDocument();
  });

  it('renders a single-family pairing as one name, not "X + X"', async () => {
    render(<Settings />);

    const section = await screen.findByTestId('settings-typography-section');
    const accessible = themeCard(section, 'Accessible');
    expect(within(accessible).getByText('Atkinson Hyperlegible')).toBeInTheDocument();
  });

  it('clicking a theme card applies the combination and updates both the Font and FontSize rows', async () => {
    // The Font row starts on a value the applied combo will genuinely change, so "both rows
    // updated" is actually exercised -- if both started equal, a dropped onApplied(result.font)
    // would pass silently.
    vi.mocked(settingsService.getSettings).mockResolvedValue(
      structuredClone(SETTINGS).map((s) => (s.keyType === 'Font' ? { ...s, value: 'accessible' } : s)),
    );
    vi.mocked(settingsService.applyTypographyCombination).mockResolvedValue({
      font: { ...SETTINGS[0], value: 'warm-editorial' },
      fontSize: { ...SETTINGS[2], value: 'comfortable' },
    });

    render(<Settings />);
    const section = await screen.findByTestId('settings-typography-section');

    fireEvent.click(themeCard(section, 'Academic'));

    await waitFor(() => expect(settingsService.applyTypographyCombination).toHaveBeenCalledWith('academic'));
    // Both values landed: the summary now resolves to the Academic theme, whose pairing came from
    // result.font and whose scale came from result.fontSize.
    await waitFor(() => expect(within(section).getByText(/Lora \+ Inter · 112% text size/)).toBeInTheDocument());
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('marks the live theme as in use and makes its card non-actionable', async () => {
    render(<Settings />);

    // SETTINGS seeds font.pairing="default" and font.size="default" -- the Default theme matches both.
    const section = await screen.findByTestId('settings-typography-section');
    const current = within(section).getByRole('button', { name: /default theme, currently in use/i });

    expect(current).toBeDisabled();
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(within(current).getByText(/in use/i)).toBeInTheDocument();
  });

  it('disables every other card while an apply is in flight', async () => {
    let resolveApply: (value: settingsService.TypographyApplyResultDto) => void;
    vi.mocked(settingsService.applyTypographyCombination).mockReturnValue(
      new Promise((resolve) => {
        resolveApply = resolve;
      }),
    );

    render(<Settings />);
    const section = await screen.findByTestId('settings-typography-section');
    const clicked = themeCard(section, 'Academic');

    fireEvent.click(clicked);

    await waitFor(() => expect(within(clicked).getByText(/applying/i)).toBeInTheDocument());
    expect(themeCard(section, 'Presentation')).toBeDisabled();

    resolveApply!({ font: SETTINGS[0], fontSize: SETTINGS[2] });
    await waitFor(() => expect(themeCard(section, 'Presentation')).not.toBeDisabled());
  });

  it('surfaces an applyTypographyCombination rejection via role="alert"', async () => {
    vi.mocked(settingsService.applyTypographyCombination).mockRejectedValue(
      new settingsService.SettingsError("'made-up' is not a currently curated typography combination."),
    );

    render(<Settings />);
    const section = await screen.findByTestId('settings-typography-section');

    fireEvent.click(themeCard(section, 'Academic'));

    expect(await within(section).findByRole('alert')).toHaveTextContent("'made-up' is not a currently curated typography combination.");
  });

  // -- Advanced: the font + size composer -----------------------------------------------------

  it('keeps the composer out of the DOM until Advanced is opened', async () => {
    render(<Settings />);
    const section = await screen.findByTestId('settings-typography-section');

    expect(within(section).queryByRole('combobox', { name: /^font$/i })).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: /^advanced$/i }));

    expect(within(section).getByRole('combobox', { name: /^font$/i })).toBeInTheDocument();
    expect(within(section).getByRole('combobox', { name: /text size/i })).toBeInTheDocument();
  });

  it('opens the composer already reflecting what is live, with nothing to save', async () => {
    render(<Settings />);
    const section = await openAdvanced();

    expect(within(section).getByRole('combobox', { name: /^font$/i })).toHaveValue('default');
    expect(within(section).getByRole('combobox', { name: /text size/i })).toHaveValue('default');
    // Nothing staged yet -- Save must not offer to re-apply the values already in effect.
    expect(within(section).getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(within(section).getByText(/what's live right now/i)).toBeInTheDocument();
  });

  it('labels the font options by real font names, not internal slugs', async () => {
    render(<Settings />);
    const section = await openAdvanced();

    const picker = within(section).getByRole('combobox', { name: /^font$/i });
    expect(within(picker).getByRole('option', { name: 'Fraunces + Outfit' })).toBeInTheDocument();
    expect(within(picker).getByRole('option', { name: 'Lora + Inter' })).toBeInTheDocument();
    // The stored slug is what gets applied, but it is never what the admin reads.
    expect(within(picker).queryByRole('option', { name: 'warm-editorial' })).not.toBeInTheDocument();
  });

  it('previews the two selections together, reflecting both the chosen font and the chosen scale', async () => {
    render(<Settings />);
    const section = await openAdvanced();

    fireEvent.change(within(section).getByRole('combobox', { name: /^font$/i }), { target: { value: 'warm-editorial' } });
    fireEvent.change(within(section).getByRole('combobox', { name: /text size/i }), { target: { value: 'comfortable' } });

    // One preview showing the combination -- the whole point of the composer is that font and size
    // are judged together, so a preview reflecting only one of them would defeat it.
    const preview = await screen.findByTestId('typography-preview');
    expect(within(preview).getByText('Sample Heading')).toHaveStyle({ fontFamily: '"Lora", serif' });
    expect(within(preview).getByText(/The quick brown fox/)).toHaveStyle({ fontFamily: '"Inter", sans-serif' });
    expect(within(preview).getByText(/Lora \+ Inter · 112%/)).toBeInTheDocument();
    // Staging a selection must never write anything.
    expect(settingsService.applyTypography).not.toHaveBeenCalled();
  });

  it('saves both selections in a single atomic call', async () => {
    vi.mocked(settingsService.applyTypography).mockResolvedValue({
      font: { ...SETTINGS[0], value: 'warm-editorial' },
      fontSize: { ...SETTINGS[2], value: 'comfortable' },
    });

    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.change(within(section).getByRole('combobox', { name: /^font$/i }), { target: { value: 'warm-editorial' } });
    fireEvent.change(within(section).getByRole('combobox', { name: /text size/i }), { target: { value: 'comfortable' } });

    fireEvent.click(within(section).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(settingsService.applyTypography).toHaveBeenCalledWith('warm-editorial', 'comfortable'));
    await waitFor(() => expect(within(section).getByText(/Lora \+ Inter · 112% text size/)).toBeInTheDocument());
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('re-disables Save once the staged pair matches what is live again', async () => {
    render(<Settings />);
    const section = await openAdvanced();
    const fontPicker = within(section).getByRole('combobox', { name: /^font$/i });

    fireEvent.change(fontPicker, { target: { value: 'warm-editorial' } });
    expect(within(section).getByRole('button', { name: /^save$/i })).toBeEnabled();

    fireEvent.change(fontPicker, { target: { value: 'default' } });
    expect(within(section).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('Reset discards staged selections and returns the composer to the live values', async () => {
    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.change(within(section).getByRole('combobox', { name: /^font$/i }), { target: { value: 'warm-editorial' } });

    fireEvent.click(within(section).getByRole('button', { name: /^reset$/i }));

    expect(within(section).getByRole('combobox', { name: /^font$/i })).toHaveValue('default');
    expect(within(section).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('re-syncs the composer when a theme is applied while Advanced is open', async () => {
    vi.mocked(settingsService.applyTypographyCombination).mockResolvedValue({
      font: { ...SETTINGS[0], value: 'warm-editorial' },
      fontSize: { ...SETTINGS[2], value: 'comfortable' },
    });

    render(<Settings />);
    const section = await openAdvanced();
    // Stage something the theme is about to overwrite.
    fireEvent.change(within(section).getByRole('combobox', { name: /text size/i }), { target: { value: 'presentation' } });

    fireEvent.click(themeCard(section, 'Academic'));

    // The composer must follow the newly-applied theme rather than keeping a stale staged value
    // that would let Save silently undo the theme just applied.
    await waitFor(() => expect(within(section).getByRole('combobox', { name: /^font$/i })).toHaveValue('warm-editorial'));
    expect(within(section).getByRole('combobox', { name: /text size/i })).toHaveValue('comfortable');
    expect(within(section).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('surfaces an applyTypography rejection via role="alert" instead of silently swallowing it', async () => {
    vi.mocked(settingsService.applyTypography).mockRejectedValue(
      new settingsService.SettingsError("'warm-editorial' is not a currently curated font pairing."),
    );

    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.change(within(section).getByRole('combobox', { name: /^font$/i }), { target: { value: 'warm-editorial' } });

    fireEvent.click(within(section).getByRole('button', { name: /^save$/i }));

    expect(await within(section).findByRole('alert')).toHaveTextContent("'warm-editorial' is not a currently curated font pairing.");
  });

  it('surfaces a getFontPairings fetch failure via role="alert" instead of a silent empty picker', async () => {
    vi.mocked(settingsService.getFontPairings).mockRejectedValue(new settingsService.SettingsError('Could not load font pairings.'));

    render(<Settings />);
    const section = await openAdvanced();

    expect(await within(section).findByRole('alert')).toHaveTextContent('Could not load font pairings.');
  });

  it('surfaces a getFontSizes fetch failure via role="alert" instead of a silent empty picker', async () => {
    vi.mocked(settingsService.getFontSizes).mockRejectedValue(new settingsService.SettingsError('Could not load font sizes.'));

    render(<Settings />);
    const section = await openAdvanced();

    expect(await within(section).findByRole('alert')).toHaveTextContent('Could not load font sizes.');
  });

  // -- Advanced: change history ---------------------------------------------------------------

  it('fetches both settings histories only when opened, and merges them newest-first', async () => {
    vi.mocked(settingsService.getSettingHistory).mockImplementation((id: string) =>
      Promise.resolve(structuredClone(id === 'setting_font' ? HISTORY : SIZE_HISTORY)),
    );

    render(<Settings />);
    const section = await openAdvanced();
    expect(settingsService.getSettingHistory).not.toHaveBeenCalled();

    fireEvent.click(within(section).getByRole('button', { name: /view history/i }));

    await waitFor(() => expect(settingsService.getSettingHistory).toHaveBeenCalledWith('setting_font'));
    expect(settingsService.getSettingHistory).toHaveBeenCalledWith('setting_font_size');

    // Stored slugs are resolved to human names per entry KIND: a FontSize entry resolves against
    // the scales, a Font entry against the pairings. 'discontinued-pairing' has no curated
    // definition left, so it falls back to the raw stored value rather than rendering blank.
    const sizeEntry = await within(section).findByText(/100% → 112%/);
    const fontEntry = within(section).getByText(/Fraunces \+ Outfit → Lora \+ Inter/);
    const oldest = within(section).getByText(/discontinued-pairing → Fraunces \+ Outfit/);

    // Merged strictly by changedAt across both settings, not grouped by setting: size 16:00 >
    // font 12:00 > font 09:00.
    expect(sizeEntry.compareDocumentPosition(fontEntry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fontEntry.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('restoring a history entry stages it in the matching dropdown instead of applying it outright', async () => {
    vi.mocked(settingsService.getSettingHistory).mockImplementation((id: string) =>
      Promise.resolve(id === 'setting_font' ? structuredClone(HISTORY) : []),
    );

    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.click(within(section).getByRole('button', { name: /view history/i }));
    const [restoreButton] = await within(section).findAllByRole('button', { name: /^restore$/i });

    fireEvent.click(restoreButton);

    // Staged for review in the composer -- never written straight through, which would bypass the
    // preview and could half-apply a pair.
    expect(within(section).getByRole('combobox', { name: /^font$/i })).toHaveValue('warm-editorial');
    expect(settingsService.applyTypography).not.toHaveBeenCalled();
  });

  it('a history entry whose newValue is no longer curated is not restorable', async () => {
    vi.mocked(settingsService.getSettingHistory).mockImplementation((id: string) =>
      Promise.resolve(id === 'setting_font' ? structuredClone(HISTORY_WITH_DECURATED_ENTRY) : []),
    );

    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.click(within(section).getByRole('button', { name: /view history/i }));

    await within(section).findByText(/Fraunces \+ Outfit → retired-pairing/);
    expect(within(section).queryByRole('button', { name: /^restore$/i })).not.toBeInTheDocument();
    expect(within(section).getByText(/no longer curated/i)).toBeInTheDocument();
  });

  // Reproduces the stale-cache bug found in review -- save while History is closed, then open
  // History; it must fetch fresh rather than serve the pre-save cached array.
  it('invalidates the cached history when a save succeeds while the history panel is closed', async () => {
    vi.mocked(settingsService.applyTypography).mockResolvedValue({
      font: { ...SETTINGS[0], value: 'warm-editorial' },
      fontSize: { ...SETTINGS[2], value: 'default' },
    });

    render(<Settings />);
    const section = await openAdvanced();

    // History is never opened before the save -- isHistoryOpen is false the whole time.
    fireEvent.change(within(section).getByRole('combobox', { name: /^font$/i }), { target: { value: 'warm-editorial' } });
    fireEvent.click(within(section).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(settingsService.applyTypography).toHaveBeenCalled());

    vi.mocked(settingsService.getSettingHistory).mockResolvedValue([
      { id: 'history_new', settingId: 'setting_font', key: 'font.pairing', keyType: 'Font', oldValue: 'default', newValue: 'warm-editorial', changedAt: '2026-08-16T00:00:00Z', changedBy: 'admin_1' },
    ]);
    fireEvent.click(within(section).getByRole('button', { name: /view history/i }));

    await within(section).findAllByText(/Fraunces \+ Outfit → Lora \+ Inter/);
  });

  it('surfaces a getSettingHistory fetch failure via role="alert", distinct from a genuinely empty history', async () => {
    vi.mocked(settingsService.getSettingHistory).mockRejectedValue(new settingsService.SettingsError('Could not load history.'));

    render(<Settings />);
    const section = await openAdvanced();
    fireEvent.click(within(section).getByRole('button', { name: /view history/i }));

    expect(await within(section).findByRole('alert')).toHaveTextContent('Could not load history.');
    expect(within(section).queryByText(/no changes yet/i)).not.toBeInTheDocument();
  });

  // This fixture provides only a Font setting (no FontSize row), so the "both exist" gate is false
  // and it falls back to the generic per-KeyType rendering (settings-font-section) -- deliberately
  // unchanged, exercising the partial-data path rather than the Appearance section.
  it('renders a fallback dash instead of the literal "Invalid Date" for an unparseable date string', async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue([
      { ...structuredClone(SETTINGS[0]), createdAt: 'not-a-real-date', updatedAt: null },
    ]);

    render(<Settings />);

    const fontSection = await screen.findByTestId('settings-font-section');
    expect(await within(fontSection).findByText(/Last changed —/)).toBeInTheDocument();
    expect(within(fontSection).queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
