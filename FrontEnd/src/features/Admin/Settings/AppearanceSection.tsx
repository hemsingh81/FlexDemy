import React, { useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import { Alert } from '../../../ui/Alert';
import * as settingsService from '../../../services/settingsService';
import { pairingLabel } from './utils';
import { useApplyTypography } from './useApplyTypography';
import { ThemeCard } from './ThemeCard';
import { TypographyComposer } from './TypographyComposer';
import type { SettingDto, FontPairingDefinitionDto, FontSizeDefinitionDto, TypographyCombinationDefinitionDto } from '../../../services/settingsService';

// Story 6.5: the primary surface -- a theme grid plus one Advanced disclosure. Replaces the generic
// per-KeyType rendering for the Font/FontSize KeyTypes only (see Settings.tsx); every other KeyType
// still renders exactly as before.
export const AppearanceSection: React.FC<{
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
  const { error: comboError, apply } = useApplyTypography(onApplied);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  // Distinct from the hook's own isApplying: this tracks WHICH card is mid-apply, so only that
  // card's ThemeCard renders "Applying…" while the rest just go disabled (isBusy).
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);

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
    await apply(() => settingsService.applyTypographyCombination(combo.slug), `${combo.label} theme applied site-wide.`);
    setApplyingSlug(null);
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
