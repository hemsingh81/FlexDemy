import React, { useEffect, useRef, useState } from 'react';
import type { ThumbnailCrop } from './useCourseDraft';

// Fixed step per arrow-key press, as a percentage of the crop region's width (ArrowLeft/Right)
// or height (ArrowUp/Down) (story Dev Notes/AC#6 default -- pick a different value only if it
// demonstrably feels wrong in manual testing).
const NUDGE_STEP = 1;

// NaN-safe: Math.min/max propagate NaN instead of clamping it, so an invalid `n` (a zero-size
// getBoundingClientRect() during drag, or a transient non-numeric input value) must be caught
// before clamping, not after -- falls back to the nearer bound (0) rather than corrupting crop
// state with NaN.
const clamp = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);

interface ThumbnailCropToolProps {
  imageUrl: string;
  onConfirm: (crop: ThumbnailCrop) => void;
  onCancel: () => void;
}

// Hand-rolled crop tool -- no crop library exists in package.json today (confirmed during story
// research) and this story's scope (fixed 16:9, keyboard-operable) doesn't need one. Crop state
// is x/y (percentage offset of the image's center within the frame) + zoom (percentage scale),
// applied via a CSS transform on the <img>.
export const ThumbnailCropTool: React.FC<ThumbnailCropToolProps> = ({ imageUrl, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<ThumbnailCrop>({ x: 50, y: 50, zoom: 100 });

  // Tracks the currently-attached window listeners so they can be torn down on unmount even if
  // mouseup never fires (e.g. the wizard is closed mid-drag) -- without this, a stale listener
  // stays attached to `window` referencing this instance until some later mouseup elsewhere.
  const activeDragListenersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);
  useEffect(
    () => () => {
      if (activeDragListenersRef.current) {
        window.removeEventListener('mousemove', activeDragListenersRef.current.move);
        window.removeEventListener('mouseup', activeDragListenersRef.current.up);
      }
    },
    []
  );

  const nudge = (dx: number, dy: number) =>
    setCrop((c) => ({ ...c, x: clamp(c.x + dx, 0, 100), y: clamp(c.y + dy, 0, 100) }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        nudge(-NUDGE_STEP, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        nudge(NUDGE_STEP, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nudge(0, -NUDGE_STEP);
        break;
      case 'ArrowDown':
        e.preventDefault();
        nudge(0, NUDGE_STEP);
        break;
      default:
        break;
    }
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // A zero-size rect (layout not yet settled) would divide-by-zero into NaN -- skip the drag
    // entirely rather than let clamp()'s NaN fallback silently snap the crop to a corner.
    if (rect.width === 0 || rect.height === 0) return;

    const handleMove = (moveEvent: MouseEvent) => {
      setCrop((c) => ({
        ...c,
        x: clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100),
        y: clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100),
      }));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      activeDragListenersRef.current = null;
    };
    activeDragListenersRef.current = { move: handleMove, up: handleUp };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="p-4 rounded-2xl border border-[#E1DED4] bg-[#FAF7EC] space-y-3" data-testid="thumbnail-crop-tool">
      <div
        role="group"
        tabIndex={0}
        aria-label="Crop position — use arrow keys to adjust, or drag, or set exact values below"
        aria-describedby="crop-ratio-note"
        onKeyDown={handleKeyDown}
        onMouseDown={handleDrag}
        data-testid="crop-region"
        className="relative w-full aspect-video overflow-hidden rounded-xl border-2 border-[#BA5012] focus:outline-none focus:ring-2 focus:ring-[#BA5012] cursor-move"
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative crop preview, not content; the group's aria-label above is the operable label */}
        <img
          src={imageUrl}
          alt=""
          style={{ transform: `translate(${50 - crop.x}%, ${50 - crop.y}%) scale(${crop.zoom / 100})` }}
          className="w-full h-full object-cover pointer-events-none select-none"
        />
      </div>
      <p id="crop-ratio-note" className="text-[10px] text-[#5E6A79]">
        Fixed 16:9 aspect ratio — drag or use arrow keys to reposition, or set exact values below.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-[10px] font-bold text-[#142030]">
          X %
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(crop.x)}
            onChange={(e) => setCrop((c) => ({ ...c, x: clamp(Number(e.target.value), 0, 100) }))}
            className="w-full mt-0.5 p-1.5 rounded-lg bg-white border border-[#E1DED4] text-xs"
          />
        </label>
        <label className="text-[10px] font-bold text-[#142030]">
          Y %
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(crop.y)}
            onChange={(e) => setCrop((c) => ({ ...c, y: clamp(Number(e.target.value), 0, 100) }))}
            className="w-full mt-0.5 p-1.5 rounded-lg bg-white border border-[#E1DED4] text-xs"
          />
        </label>
        <label className="text-[10px] font-bold text-[#142030]">
          Zoom %
          <input
            type="number"
            min={100}
            max={300}
            value={Math.round(crop.zoom)}
            onChange={(e) => setCrop((c) => ({ ...c, zoom: clamp(Number(e.target.value), 100, 300) }))}
            className="w-full mt-0.5 p-1.5 rounded-lg bg-white border border-[#E1DED4] text-xs"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#5E6A79] hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(crop)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#BA5012] text-white hover:bg-[#BA5012]/90"
        >
          Confirm crop
        </button>
      </div>
    </div>
  );
};
