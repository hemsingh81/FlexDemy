import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Star, Trash2 } from 'lucide-react';
import { MAX_THUMBNAILS, type CourseDraftThumbnail, type ThumbnailCrop } from './useCourseDraft';
import { ThumbnailCropTool } from './ThumbnailCropTool';

interface StepThumbnailsProps {
  thumbnails: CourseDraftThumbnail[];
  addThumbnail: (file: File, crop?: ThumbnailCrop) => Promise<{ accepted: boolean; reason?: string }>;
  removeThumbnail: (id: string) => Promise<void>;
  reorderThumbnail: (id: string, direction: 'left' | 'right') => Promise<void>;
  setPrimaryThumbnail: (id: string) => Promise<void>;
}

export const StepThumbnails: React.FC<StepThumbnailsProps> = ({
  thumbnails,
  addThumbnail,
  removeThumbnail,
  reorderThumbnail,
  setPrimaryThumbnail,
}) => {
  // The local preview blob URL (for ThumbnailCropTool's live preview only) and the raw File
  // (what actually gets uploaded, Story 2.4) are tracked separately -- ThumbnailCropTool itself
  // only ever needs the former.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revokes whatever blob URL is still pending if the step unmounts (e.g. the wizard is closed
  // mid-crop) without going through handleCancelCrop/handleConfirmCrop, which already revoke on
  // their own paths. A ref, not `pendingFileUrl` itself, so the cleanup always sees the latest
  // value rather than the one from whenever this effect last re-ran.
  const pendingFileUrlRef = useRef<string | null>(null);
  useEffect(() => {
    pendingFileUrlRef.current = pendingFileUrl;
  }, [pendingFileUrl]);
  useEffect(
    () => () => {
      if (pendingFileUrlRef.current) URL.revokeObjectURL(pendingFileUrlRef.current);
    },
    []
  );

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (thumbnails.length >= MAX_THUMBNAILS) {
      setRejectionMessage(`Maximum ${MAX_THUMBNAILS} thumbnails allowed. Remove one before adding another.`);
      return;
    }

    setRejectionMessage(null);
    setPendingFile(file);
    setPendingFileUrl(URL.createObjectURL(file));
  };

  const handleCancelCrop = () => {
    if (pendingFileUrl) URL.revokeObjectURL(pendingFileUrl);
    setPendingFile(null);
    setPendingFileUrl(null);
  };

  const handleConfirmCrop = async (crop: ThumbnailCrop) => {
    if (!pendingFile || !pendingFileUrl) return;
    // The preview blob URL's job ends here either way -- the real upload sends `pendingFile`
    // (the raw bytes), not this local-only preview.
    URL.revokeObjectURL(pendingFileUrl);
    const file = pendingFile;
    setPendingFile(null);
    setPendingFileUrl(null);

    const result = await addThumbnail(file, crop);
    if (!result.accepted && result.reason) setRejectionMessage(result.reason);
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <label className="font-bold text-[#142030]">
          Thumbnails ({thumbnails.length}/{MAX_THUMBNAILS}):
        </label>
        <p className="text-[10px] text-[#5E6A79] mt-0.5">Up to {MAX_THUMBNAILS} images, cropped to a fixed 16:9 ratio.</p>
      </div>

      {rejectionMessage && (
        <p role="alert" className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {rejectionMessage}
        </p>
      )}

      {pendingFileUrl && <ThumbnailCropTool imageUrl={pendingFileUrl} onConfirm={handleConfirmCrop} onCancel={handleCancelCrop} />}

      <div className="grid grid-cols-3 gap-3">
        {thumbnails.map((thumb, idx) => (
          <div key={thumb.id} className="relative rounded-xl overflow-hidden border border-[#E1DED4] bg-slate-100 aspect-video group">
            <img
              src={thumb.url}
              alt={`Course thumbnail ${idx + 1}`}
              style={{ transform: `translate(${50 - thumb.crop.x}%, ${50 - thumb.crop.y}%) scale(${thumb.crop.zoom / 100})` }}
              className="w-full h-full object-cover"
            />
            {thumb.isPrimary && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-[#143358] text-white text-[9px] font-bold">
                Primary
              </span>
            )}
            <div className="absolute bottom-1 inset-x-1 flex items-center justify-center gap-1 bg-white/90 rounded-lg py-1">
              <button
                type="button"
                aria-label="Move thumbnail left"
                disabled={idx === 0}
                onClick={() => reorderThumbnail(thumb.id, 'left')}
                className="p-1 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label={thumb.isPrimary ? 'Already primary thumbnail' : 'Set as primary thumbnail'}
                onClick={() => setPrimaryThumbnail(thumb.id)}
                className="p-1 rounded"
              >
                <Star className={`w-3.5 h-3.5 ${thumb.isPrimary ? 'fill-[#BA5012] text-[#BA5012]' : ''}`} />
              </button>
              <button
                type="button"
                aria-label="Delete thumbnail"
                onClick={() => removeThumbnail(thumb.id)}
                className="p-1 rounded text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move thumbnail right"
                disabled={idx === thumbnails.length - 1}
                onClick={() => reorderThumbnail(thumb.id, 'right')}
                className="p-1 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {thumbnails.length < MAX_THUMBNAILS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            // Disabled while a crop is already pending -- otherwise picking a second file here
            // would silently replace `pendingFileUrl` and discard the tutor's in-progress crop.
            disabled={Boolean(pendingFileUrl)}
            aria-label="Add thumbnail"
            className="aspect-video rounded-xl border-2 border-dashed border-[#E1DED4] flex flex-col items-center justify-center text-[#5E6A79] hover:border-[#BA5012] hover:text-[#BA5012] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#E1DED4] disabled:hover:text-[#5E6A79]"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Add thumbnail</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
        aria-label="Choose thumbnail image file"
        data-testid="thumbnail-file-input"
      />
    </div>
  );
};
