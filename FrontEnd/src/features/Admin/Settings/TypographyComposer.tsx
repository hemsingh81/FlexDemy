import React, { useEffect, useState } from 'react';
import { Alert } from '../../../ui/Alert';
import * as settingsService from '../../../services/settingsService';
import { pairingLabel } from './utils';
import { useApplyTypography } from './useApplyTypography';
import { ChangeHistory } from './ChangeHistory';
import type { SettingDto, FontPairingDefinitionDto, FontSizeDefinitionDto, SettingChangeHistoryDto } from '../../../services/settingsService';

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
export const TypographyComposer: React.FC<{
  fontSetting: SettingDto;
  fontSizeSetting: SettingDto;
  pairings: FontPairingDefinitionDto[];
  pairingsError: string | null;
  sizes: FontSizeDefinitionDto[];
  sizesError: string | null;
  onApplied: (updated: SettingDto) => void;
}> = ({ fontSetting, fontSizeSetting, pairings, pairingsError, sizes, sizesError, onApplied }) => {
  const { isApplying: isSaving, error: saveError, apply, clearError } = useApplyTypography(onApplied);
  const [fontSlug, setFontSlug] = useState(fontSetting.value);
  const [sizeSlug, setSizeSlug] = useState(fontSizeSetting.value);

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
    const result = await apply(
      () => settingsService.applyTypography(fontSlug, sizeSlug),
      `Typography saved — ${pairingLabel(selectedPairing)} at ${selectedSize.rootFontScale}.`
    );
    if (!result) return;
    // Unconditional cache invalidation, not just a refetch when the panel happens to be open --
    // otherwise reopening history after a save made while closed serves a stale list missing the
    // entries that save just created.
    if (isHistoryOpen) {
      fetchHistory();
    } else {
      setHistory(null);
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
              clearError();
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
