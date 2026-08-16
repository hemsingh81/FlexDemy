import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Palette, SlidersHorizontal } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { Alert } from '../../../ui/Alert';
import { useSettings } from './useSettings';
import { useAsync } from '../../../hooks/useAsync';
import { useSiteSettings } from '../../../context/SiteSettingsContext';
import { useToast } from '../../../context/ToastContext';
import * as settingsService from '../../../services/settingsService';
import type {
  SettingDto,
  FontPairingDefinitionDto,
  FontSizeDefinitionDto,
  SettingChangeHistoryDto,
  TypographyCombinationDefinitionDto,
} from '../../../services/settingsService';

// Admin -> Settings sub-tab (AdminSettings PRD FR-4/FR-5, backend AD-25/AD-27).
//
// Presented as an Appearance/theme picker rather than a list of raw Setting rows: a theme (backend
// TypographyCombinationDefinition) bundles a font pairing + a text scale, and each card previews
// itself in its own real fonts at its own real scale, so choosing one is a visual decision rather
// than a slug-matching one. Everything an admin doesn't need in order to make that choice --
// setting keys, actor ids, timestamps, independent font-vs-size control, change history -- lives
// under one Advanced disclosure instead of on the primary surface.
//
// Preview NEVER touches document.documentElement and never calls applySetting -- only a successful
// Apply does either, and only SiteSettingsContext (never this component) touches
// document.documentElement (AD-8).

// Code-review patch (2026-08-16): guards against an unparseable date string rendering the literal
// text "Invalid Date" -- falls back to an em dash instead.
const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

// '"Playfair Display", Georgia, serif' -> 'Playfair Display'. Lets every label in this screen read
// as the font's actual name instead of an internal slug ("academic"), without adding a display-name
// column to FontPairingDefinition -- the name is already in the CSS font-family string the backend
// sends. Falls back to the raw string if it somehow has no leading family.
const primaryFontName = (cssFontFamily: string): string => {
  const first = cssFontFamily.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '') || cssFontFamily;
};

// "Fraunces + Outfit" for a two-family pairing, just "Atkinson Hyperlegible" when display and body
// are the same family (the Accessible pairing) -- "X + X" reads like a mistake.
const pairingLabel = (pairing: FontPairingDefinitionDto): string => {
  const display = primaryFontName(pairing.displayFont);
  const body = primaryFontName(pairing.bodyFont);
  return display === body ? display : `${display} + ${body}`;
};

// The API returns each catalog in insertion order, which is arbitrary from a reader's point of
// view -- font sizes arrived as 100%, 90%, 140%, 125%, 112%, and themes in whatever order they were
// seeded. Both get a deliberate order here rather than server-side, since this is presentation, not
// data: sizes ascend numerically (a scale picker that doesn't run small-to-large is just hard to
// use), and themes sort by label with Default pinned first as the baseline everything else varies
// from. parseFloat handles the "112%" form by ignoring the trailing unit.
const bySizeAscending = (a: FontSizeDefinitionDto, b: FontSizeDefinitionDto) =>
  parseFloat(a.rootFontScale) - parseFloat(b.rootFontScale);

const byThemeLabel = (a: TypographyCombinationDefinitionDto, b: TypographyCombinationDefinitionDto) => {
  if (a.slug === 'default') return -1;
  if (b.slug === 'default') return 1;
  return a.label.localeCompare(b.label);
};

const groupByKeyType = (settings: SettingDto[]): Map<string, SettingDto[]> => {
  const groups = new Map<string, SettingDto[]>();
  for (const setting of settings) {
    const existing = groups.get(setting.keyType);
    if (existing) {
      existing.push(setting);
    } else {
      groups.set(setting.keyType, [setting]);
    }
  }
  return groups;
};

// Story 6.3, reworked for the composer: ONE history list covering both the Font and FontSize
// Settings, merged newest-first, rather than a separate panel per Setting. The composer changes
// both together, so splitting their histories would force an admin to cross-reference two lists to
// reconstruct a single save.
//
// Restore stages the value into the composer's dropdown rather than applying it on the spot: the
// composer's whole contract is "choose both, preview, then save", and a restore that wrote straight
// through would bypass the preview and could half-apply a pair.
const ChangeHistory: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  history: SettingChangeHistoryDto[] | null;
  isLoading: boolean;
  error: string | null;
  // A history entry is restorable only if its newValue is still curated. Client-side courtesy so
  // the rejection isn't discovered only after saving; the backend enforces it regardless.
  isRestorable: (entry: SettingChangeHistoryDto) => boolean;
  onRestore: (entry: SettingChangeHistoryDto) => void;
  // Human-facing name for a stored slug, so history reads "Fraunces + Outfit", not "default".
  describeValue: (entry: SettingChangeHistoryDto, value: string) => string;
}> = ({ isOpen, onToggle, history, isLoading, error, isRestorable, onRestore, describeValue }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex items-center gap-1 text-[11px] font-bold text-[#143358] hover:underline cursor-pointer"
    >
      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      {isOpen ? 'Hide history' : 'View history'}
    </button>

    {isOpen && (
      <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto animate-[fade-in-scale_150ms_ease-out]" aria-label="Version history">
        {isLoading && <p className="text-xs text-[#5E6A79]">Loading…</p>}
        {!isLoading && error && <Alert>{error}</Alert>}
        {!isLoading && !error && history?.length === 0 && <p className="text-xs text-[#5E6A79]">No changes yet.</p>}
        {!isLoading &&
          history?.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs"
            >
              <span className="text-[#142030] min-w-0">
                <span className="truncate block">
                  <span className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide mr-1.5">
                    {entry.keyType === 'FontSize' ? 'Size' : 'Font'}
                  </span>
                  {describeValue(entry, entry.oldValue)} → {describeValue(entry, entry.newValue)}
                </span>
                <span className="text-[#5E6A79]">
                  {formatDate(entry.changedAt)}
                  {entry.changedBy ? ` by ${entry.changedBy}` : ''}
                </span>
              </span>
              {isRestorable(entry) ? (
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="text-[11px] font-bold text-[#143358] underline cursor-pointer shrink-0"
                >
                  Restore
                </button>
              ) : (
                <span className="text-[10px] text-[#5E6A79] shrink-0 italic">No longer curated</span>
              )}
            </div>
          ))}
      </div>
    )}
  </div>
);

// The Advanced composer. Font and text size are chosen side by side, previewed TOGETHER, then saved
// as one action -- rather than the previous shape, where each was its own picker with its own
// preview and its own Apply button. Two reasons that matters beyond layout:
//   1. Font and size interact visually. A scale that reads well at one font's x-height can be too
//      tight at another's, so a preview of either alone can't answer "does this combination work?".
//   2. Saving them separately can half-apply. settingsService.applyTypography sends both slugs to
//      one transactional endpoint, so the site never lands on the new font at the old size.
// Selections are staged locally and nothing is written until Save, so previewing stays free of
// consequences -- and, as everywhere else on this screen, preview never touches
// document.documentElement (AD-8).
const TypographyComposer: React.FC<{
  fontSetting: SettingDto;
  fontSizeSetting: SettingDto;
  pairings: FontPairingDefinitionDto[];
  pairingsError: string | null;
  sizes: FontSizeDefinitionDto[];
  sizesError: string | null;
  onApplied: (updated: SettingDto) => void;
}> = ({ fontSetting, fontSizeSetting, pairings, pairingsError, sizes, sizesError, onApplied }) => {
  const { refetch: refetchSiteSettings } = useSiteSettings();
  const { showToast } = useToast();
  const [fontSlug, setFontSlug] = useState(fontSetting.value);
  const [sizeSlug, setSizeSlug] = useState(fontSizeSetting.value);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SettingChangeHistoryDto[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Distinct from an empty `history` array -- a fetch failure must not render the same
  // "No changes yet." copy as a genuinely empty history.
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Re-sync when the live values change underneath the composer -- e.g. the admin applies a theme
  // card while Advanced is open. Without this the dropdowns would keep showing the pre-theme
  // selection, and Save would sit enabled offering to undo the theme just applied.
  useEffect(() => {
    setFontSlug(fontSetting.value);
    setSizeSlug(fontSizeSetting.value);
  }, [fontSetting.value, fontSizeSetting.value]);

  const selectedPairing = pairings.find((p) => p.slug === fontSlug);
  const selectedSize = sizes.find((s) => s.slug === sizeSlug);
  const isDirty = fontSlug !== fontSetting.value || sizeSlug !== fontSizeSetting.value;

  const describeValue = (entry: SettingChangeHistoryDto, value: string) => {
    if (entry.keyType === 'FontSize') return sizes.find((s) => s.slug === value)?.rootFontScale ?? value;
    const pairing = pairings.find((p) => p.slug === value);
    return pairing ? pairingLabel(pairing) : value;
  };

  // Both Settings' histories in one list, newest first. A rejection from either surfaces rather
  // than silently presenting a half-list as if it were complete.
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const [fontHistory, sizeHistory] = await Promise.all([
        settingsService.getSettingHistory(fontSetting.id),
        settingsService.getSettingHistory(fontSizeSetting.id),
      ]);
      setHistory(
        [...fontHistory, ...sizeHistory].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()),
      );
    } catch (e) {
      setHistory([]);
      setHistoryError(e instanceof settingsService.SettingsError ? e.message : 'Could not load history. Please try again.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const opening = !isHistoryOpen;
    setIsHistoryOpen(opening);
    if (opening && history === null) fetchHistory();
  };

  const handleSave = async () => {
    if (!selectedPairing || !selectedSize) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await settingsService.applyTypography(fontSlug, sizeSlug);
      onApplied(result.font);
      onApplied(result.fontSize);
      // Updates the saving admin's own session immediately -- NFR-1 only requires this for *other*
      // users on their next page load.
      refetchSiteSettings();
      showToast({
        message: `Typography saved — ${pairingLabel(selectedPairing)} at ${selectedSize.rootFontScale}.`,
        variant: 'success',
      });
      // Unconditional cache invalidation, not just a refetch when the panel happens to be open --
      // otherwise reopening history after a save made while closed serves a stale list missing the
      // entries that save just created.
      if (isHistoryOpen) {
        fetchHistory();
      } else {
        setHistory(null);
      }
    } catch (e) {
      setSaveError(e instanceof settingsService.SettingsError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="composer-font" className="block text-xs font-semibold text-[#142030]">
            Font
          </label>
          <select
            id="composer-font"
            className="w-full text-xs rounded-lg border border-[#E1DED4] px-2 py-2 bg-white"
            value={fontSlug}
            onChange={(e) => setFontSlug(e.target.value)}
          >
            {pairings.map((pairing) => (
              <option key={pairing.slug} value={pairing.slug}>
                {pairingLabel(pairing)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="composer-size" className="block text-xs font-semibold text-[#142030]">
            Text size
          </label>
          <select
            id="composer-size"
            className="w-full text-xs rounded-lg border border-[#E1DED4] px-2 py-2 bg-white"
            value={sizeSlug}
            onChange={(e) => setSizeSlug(e.target.value)}
          >
            {sizes.map((size) => (
              <option key={size.slug} value={size.slug}>
                {size.rootFontScale}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pairingsError && <Alert>{pairingsError}</Alert>}
      {sizesError && <Alert>{sizesError}</Alert>}

      {/* One preview of the two selections combined. Same fixed-16px-baseline + em-based sizing
          rationale as ThemeCard: a wrapper's own font-size can't affect rem-based Tailwind text-*
          utilities, so the baseline is pinned and every sample sizes itself in em instead. */}
      {selectedPairing && selectedSize && (
        <div
          data-testid="typography-preview"
          className="rounded-xl border border-[#E1DED4] bg-[#FAF7EC] p-4"
          style={{ fontSize: '16px' }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">Preview</p>
            <p className="text-[10px] text-[#5E6A79]">
              {pairingLabel(selectedPairing)} · {selectedSize.rootFontScale}
            </p>
          </div>
          <div style={{ fontSize: selectedSize.rootFontScale }} className="space-y-2">
            <h4 className="font-bold text-[#142030]" style={{ fontFamily: selectedPairing.displayFont, fontSize: '1.5em' }}>
              Sample Heading
            </h4>
            <p className="text-[#142030]" style={{ fontFamily: selectedPairing.bodyFont, fontSize: '1em' }}>
              The quick brown fox jumps over the lazy dog.
            </p>
            <code className="block text-[#142030]" style={{ fontFamily: selectedPairing.monoFont, fontSize: '0.85em' }}>
              const sample = &quot;code&quot;;
            </code>
          </div>
        </div>
      )}

      {saveError && <Alert>{saveError}</Alert>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving || !selectedPairing || !selectedSize}
          className="text-xs font-extrabold px-4 py-2 rounded-full bg-[#143358] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {isDirty ? (
          <button
            type="button"
            onClick={() => {
              setFontSlug(fontSetting.value);
              setSizeSlug(fontSizeSetting.value);
              setSaveError(null);
            }}
            className="text-xs font-bold text-[#5E6A79] hover:text-[#142030] cursor-pointer"
          >
            Reset
          </button>
        ) : (
          <span className="text-[11px] text-[#5E6A79]">This is what&apos;s live right now.</span>
        )}
      </div>

      <ChangeHistory
        isOpen={isHistoryOpen}
        onToggle={toggleHistory}
        history={history}
        isLoading={isLoadingHistory}
        error={historyError}
        isRestorable={(entry) =>
          entry.keyType === 'FontSize'
            ? sizes.some((s) => s.slug === entry.newValue)
            : pairings.some((p) => p.slug === entry.newValue)
        }
        onRestore={(entry) => (entry.keyType === 'FontSize' ? setSizeSlug(entry.newValue) : setFontSlug(entry.newValue))}
        describeValue={describeValue}
      />
    </div>
  );
};

// Story 6.5: one theme. The card IS the preview and IS the control -- it renders its own pairing's
// real font families at its own scale's real percentage, so what an admin sees on the card is what
// the site becomes. That removes the separate "pick, then look at a preview pane, then press Apply"
// three-step the previous version needed.
//
// The scale math: Tailwind's text-* utilities are rem-based (relative to the *document root*,
// always, regardless of DOM nesting), so a wrapper's own font-size has zero effect on a rem-sized
// descendant. Instead the card is hard-pinned to a fixed 16px baseline (the neutral UA default that
// <html>'s own percentage math is anchored to), an inner wrapper applies the scale percentage
// relative to that fixed baseline -- pinning to a fixed baseline is what stops the preview
// compounding with whatever --root-font-scale is live right now -- and each sample uses an explicit
// em-based (never Tailwind text-*) font-size, since em resolves against the nearest ancestor. That
// genuinely scopes the preview to this card's subtree without ever touching document.documentElement.
const ThemeCard: React.FC<{
  combo: TypographyCombinationDefinitionDto;
  pairing: FontPairingDefinitionDto;
  size: FontSizeDefinitionDto;
  isCurrent: boolean;
  isBusy: boolean;
  isApplyingThis: boolean;
  onApply: () => void;
}> = ({ combo, pairing, size, isCurrent, isBusy, isApplyingThis, onApply }) => (
  <button
    type="button"
    onClick={onApply}
    disabled={isCurrent || isBusy}
    aria-pressed={isCurrent}
    aria-label={isCurrent ? `${combo.label} theme, currently in use` : `Apply the ${combo.label} theme`}
    data-testid={`typography-combo-${combo.slug}`}
    className={`text-left rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
      isCurrent
        ? 'border-[#BA5012] ring-2 ring-[#BA5012]/30 bg-[#FAF7EC] cursor-default'
        : 'border-[#E1DED4] bg-white hover:border-[#BA5012]/50 hover:shadow-md cursor-pointer'
    } ${isBusy && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{ fontSize: '16px' }}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-bold text-[#142030]">{combo.label}</span>
      {isCurrent && (
        <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#BA5012] text-white shrink-0">
          <Check className="w-3 h-3" aria-hidden="true" />
          In use
        </span>
      )}
    </div>

    {/* The actual specimen -- real families, real scale. */}
    <div
      className="rounded-xl bg-[#FAF7EC] border border-[#E1DED4] px-3 py-3 min-h-24 flex flex-col justify-center overflow-hidden"
      style={{ fontSize: size.rootFontScale }}
    >
      <span
        className="block font-bold text-[#142030] leading-tight truncate"
        style={{ fontFamily: pairing.displayFont, fontSize: '1.35em' }}
      >
        Sample Heading
      </span>
      <span
        className="block text-[#5E6A79] leading-snug mt-1"
        style={{ fontFamily: pairing.bodyFont, fontSize: '0.9em' }}
      >
        The quick brown fox jumps over the lazy dog.
      </span>
    </div>

    <div className="mt-auto">
      <p className="text-[11px] font-semibold text-[#142030] truncate" title={pairingLabel(pairing)}>
        {pairingLabel(pairing)}
      </p>
      <p className="text-[10px] text-[#5E6A79]">
        {size.rootFontScale} text size
        {isApplyingThis ? ' · Applying…' : ''}
      </p>
    </div>
  </button>
);

// Story 6.5: the primary surface -- a theme grid plus one Advanced disclosure. Replaces the generic
// per-KeyType rendering for the Font/FontSize KeyTypes only (see the Settings component below);
// every other KeyType still renders exactly as before.
const AppearanceSection: React.FC<{
  fontSetting: SettingDto;
  fontSizeSetting: SettingDto;
  pairings: FontPairingDefinitionDto[];
  pairingsError: string | null;
  sizes: FontSizeDefinitionDto[];
  sizesError: string | null;
  combinations: TypographyCombinationDefinitionDto[];
  combinationsError: string | null;
  onApplied: (updated: SettingDto) => void;
}> = ({
  fontSetting,
  fontSizeSetting,
  pairings,
  pairingsError,
  sizes,
  sizesError,
  combinations,
  combinationsError,
  onApplied,
}) => {
  const { refetch: refetchSiteSettings } = useSiteSettings();
  const { showToast } = useToast();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [comboError, setComboError] = useState<string | null>(null);

  const activePairing = pairings.find((p) => p.slug === fontSetting.value);
  const activeSize = sizes.find((s) => s.slug === fontSizeSetting.value);
  // The theme whose pairing AND size both match what's live. Undefined is a legitimate state, not
  // an error: Advanced lets font and size be set independently, so the live combination genuinely
  // may not correspond to any curated theme -- surfaced as "Custom" rather than silently showing
  // no card as current with no explanation.
  const currentCombo = combinations.find(
    (c) => c.fontPairingSlug === fontSetting.value && c.fontSizeSlug === fontSizeSetting.value,
  );

  const handleApplyCombo = async (combo: TypographyCombinationDefinitionDto) => {
    setApplyingSlug(combo.slug);
    setComboError(null);
    try {
      const result = await settingsService.applyTypographyCombination(combo.slug);
      onApplied(result.font);
      onApplied(result.fontSize);
      refetchSiteSettings();
      showToast({ message: `${combo.label} theme applied site-wide.`, variant: 'success' });
    } catch (e) {
      setComboError(e instanceof settingsService.SettingsError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setApplyingSlug(null);
    }
  };

  return (
    <section data-testid="settings-typography-section" className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs">
      <div className="flex items-center gap-2.5">
        <Palette className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
        <h3 className="font-serif text-xl font-bold text-[#142030]">Appearance</h3>
      </div>
      <p className="text-xs text-[#5E6A79] mt-1.5">
        Pick a theme to set the fonts and text size for everyone on FlexDemy. Each card previews itself in its own fonts.
      </p>

      <div data-testid="appearance-summary" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-4 mb-5 text-xs">
        <span className="text-[#5E6A79]">Currently in use:</span>
        <span className="font-bold text-[#142030]">{currentCombo ? currentCombo.label : 'Custom'}</span>
        {activePairing && activeSize && (
          <span className="text-[#5E6A79]">
            — {pairingLabel(activePairing)} · {activeSize.rootFontScale} text size
          </span>
        )}
      </div>

      {combinationsError && <Alert className="mb-3">{combinationsError}</Alert>}
      {comboError && <Alert className="mb-3">{comboError}</Alert>}

      {/* role="group", not role="list": these cards are controls that act on click, not a static
          list of content, so each one is a <button> laid out directly by the grid. A list/listitem
          pair would need a wrapper element per card, and `display: contents` on that wrapper (the
          only way to keep the grid working) drops it from the accessibility tree in several
          browsers -- taking the listitem semantics with it. */}
      <div role="group" aria-label="Themes" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {combinations.map((combo) => {
          const pairing = pairings.find((p) => p.slug === combo.fontPairingSlug);
          const size = sizes.find((s) => s.slug === combo.fontSizeSlug);
          // A combo whose referenced pairing/size hasn't resolved (fetch race, data inconsistency)
          // -- skip rather than crash. GetTypographyCombinationsAsync already filters these out
          // server-side, so this is a defensive fallback, not the primary guard.
          if (!pairing || !size) return null;

          return (
            <ThemeCard
              key={combo.slug}
              combo={combo}
              pairing={pairing}
              size={size}
              isCurrent={currentCombo?.slug === combo.slug}
              isBusy={applyingSlug !== null}
              isApplyingThis={applyingSlug === combo.slug}
              onApply={() => handleApplyCombo(combo)}
            />
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-[#E1DED4]">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((v) => !v)}
          aria-expanded={isAdvancedOpen}
          className="flex items-center gap-1.5 text-xs font-bold text-[#143358] hover:underline cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          Advanced
        </button>

        {isAdvancedOpen && (
          <div className="mt-4 space-y-6 animate-[fade-in-scale_150ms_ease-out]">
            <p className="text-[11px] text-[#5E6A79]">
              Build your own combination: pick a font and a text size, check the preview, then save. A pair that
              doesn&apos;t match one of the themes above shows as &ldquo;Custom&rdquo;.
            </p>

            <TypographyComposer
              fontSetting={fontSetting}
              fontSizeSetting={fontSizeSetting}
              pairings={pairings}
              pairingsError={pairingsError}
              sizes={sizes}
              sizesError={sizesError}
              onApplied={onApplied}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export const Settings: React.FC = () => {
  const { data: settings, setData: setSettings, isLoading, error } = useSettings();
  const { data: fontPairings, error: fontPairingsError } = useAsync<FontPairingDefinitionDto[]>(settingsService.getFontPairings, [], []);
  const { data: fontSizes, error: fontSizesError } = useAsync<FontSizeDefinitionDto[]>(settingsService.getFontSizes, [], []);
  const { data: combinations, error: combinationsError } = useAsync<TypographyCombinationDefinitionDto[]>(
    settingsService.getTypographyCombinations,
    [],
    [],
  );
  const groups = useMemo(() => groupByKeyType(settings), [settings]);
  // Sorted copies -- never sort the arrays from useAsync in place, which would mutate its cached
  // state and make the ordering depend on how many times this component happened to render.
  const sortedSizes = useMemo(() => [...fontSizes].sort(bySizeAscending), [fontSizes]);
  const sortedCombinations = useMemo(() => [...combinations].sort(byThemeLabel), [combinations]);

  const fontSetting = settings.find((s) => s.keyType === 'Font');
  const fontSizeSetting = settings.find((s) => s.keyType === 'FontSize');
  // "Both exist" gates what renders AND what's removed from the generic loop as one single decision
  // -- if only one of Font/FontSize is ever present (partial seed, a fixture, a future migration
  // mid-flight), that lone row falls back to the generic per-KeyType rendering below instead of
  // silently disappearing from the page.
  const showAppearanceSection = Boolean(fontSetting && fontSizeSetting);
  const otherGroups = new Map<string, SettingDto[]>(groups);
  if (showAppearanceSection) {
    otherGroups.delete('Font');
    otherGroups.delete('FontSize');
  }

  const handleApplied = (updated: SettingDto) => {
    setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#5E6A79]">
        <Spinner size="lg" className="mr-2" />
        <span className="text-sm">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return <Alert>{error}</Alert>;
  }

  return (
    <div className="space-y-6">
      {showAppearanceSection && fontSetting && fontSizeSetting && (
        <AppearanceSection
          fontSetting={fontSetting}
          fontSizeSetting={fontSizeSetting}
          pairings={fontPairings}
          pairingsError={fontPairingsError}
          sizes={sortedSizes}
          sizesError={fontSizesError}
          combinations={sortedCombinations}
          combinationsError={combinationsError}
          onApplied={handleApplied}
        />
      )}
      {Array.from(otherGroups.entries()).map(([keyType, keyTypeSettings]) => (
        <section
          key={keyType}
          data-testid={`settings-${keyType.toLowerCase()}-section`}
          className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <SlidersHorizontal className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
            <h3 className="font-serif text-xl font-bold text-[#142030]">{keyType}</h3>
          </div>
          <div className="space-y-3">
            {keyTypeSettings.map((setting) => (
              <div key={setting.id} className="p-3 rounded-xl border border-[#E1DED4] bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#142030] truncate">{setting.key}</p>
                    <p className="text-[10px] text-[#5E6A79] mt-0.5">Value: {setting.value}</p>
                    <p className="text-[10px] text-[#5E6A79]">
                      {/* A never-edited seeded row has null updatedAt/updatedBy -- fall back to
                          createdAt/createdBy so this never renders blank (Story 6.1). */}
                      Last changed {formatDate(setting.updatedAt ?? setting.createdAt)}
                      {(setting.updatedBy ?? setting.createdBy) ? ` by ${setting.updatedBy ?? setting.createdBy}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                      setting.isActive ? 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20' : 'bg-[#143358] text-white'
                    }`}
                  >
                    {setting.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
