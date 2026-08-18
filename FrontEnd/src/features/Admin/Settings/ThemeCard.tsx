import React from 'react';
import { Check } from 'lucide-react';
import { pairingLabel } from './utils';
import type { FontPairingDefinitionDto, FontSizeDefinitionDto, TypographyCombinationDefinitionDto } from '../../../services/settingsService';

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
export const ThemeCard: React.FC<{
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
