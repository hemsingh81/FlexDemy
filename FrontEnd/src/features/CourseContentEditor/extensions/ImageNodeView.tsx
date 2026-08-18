// Story 9.1, Task 2/3: the Image block's own interactive UI -- an empty state offering real
// Upload/drag-drop controls (mirrors LearningResourcesNodeView's own dropzone pattern), a loading
// placeholder while the upload is in flight, the resolved image once uploaded (via
// courseContentService.resolveResourceUrl, Story 8.3), and an inline alt-text field that's always
// present and focused the moment a file is chosen -- never a modal, never a settings panel.
import React, { useCallback, useRef, useState } from 'react';
import type { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Upload } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { uploadResource, resolveResourceUrl } from '../../../services/courseContentService';
import { useResolvedResourceUrl } from '../../../hooks/useResolvedResourceUrl';
import type { ContentOwnerType } from '../../../types';

const RESOURCE_PREFIX = 'resource:';

export const ImageNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, extension }) => {
  const courseId = (extension.options as { courseId: string }).courseId;
  const src = (node.attrs.src as string | null) ?? '';
  const alt = (node.attrs.alt as string | null) ?? '';
  const isUploading = node.attrs.isUploading as boolean;
  const uploadFailed = node.attrs.uploadFailed as boolean;
  const ownerType = node.attrs.ownerType as ContentOwnerType | null;
  const ownerId = node.attrs.ownerId as string | null;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altInputRef = useRef<HTMLInputElement>(null);

  const resourceId = src.startsWith(RESOURCE_PREFIX) ? src.slice(RESOURCE_PREFIX.length) : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolve = useCallback((id: string) => resolveResourceUrl(courseId, id), [courseId]);
  // Preserves this component's own pre-extraction behavior exactly: a resolve failure just
  // leaves `resolvedUrl` null (falls through to the "Loading…" placeholder below) rather than
  // showing a distinct failed state -- `failed` is deliberately unused here.
  const { url: resolvedUrl } = useResolvedResourceUrl(resolve, resourceId);

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file || !ownerType || !ownerId) return;
    // Task 2: focus moves into the alt-text field the moment the upload is dispatched, not once
    // it resolves -- the field is available for typing immediately either way.
    updateAttributes({ isUploading: true, uploadFailed: false });
    altInputRef.current?.focus();
    uploadResource(courseId, ownerType, ownerId, file, { label: file.name, role: 'Inline' })
      .then((created) => updateAttributes({ src: `${RESOURCE_PREFIX}${created.id}`, isUploading: false }))
      .catch(() => updateAttributes({ isUploading: false, uploadFailed: true }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  return (
    <NodeViewWrapper className="my-3" contentEditable={false}>
      {!resourceId && !isUploading && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 ${
            isDraggingOver ? 'border-[#BA5012] bg-[#BA5012]/5' : 'border-[#E1DED4]'
          }`}
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" aria-hidden="true" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-foreground bg-white border border-border rounded-lg hover:border-[#BA5012]"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload image
          </button>
          <span className="text-xs text-muted-foreground">or drag and drop an image here</span>
          {uploadFailed && <span className="text-xs text-destructive">Could not upload this image. Please try again.</span>}
        </div>
      )}

      {isUploading && (
        <div role="status" className="rounded-lg border border-border bg-muted/30 p-6 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span className="text-xs text-muted-foreground">Uploading…</span>
        </div>
      )}

      {resourceId &&
        !isUploading &&
        (resolvedUrl ? (
          <img src={resolvedUrl} alt={alt} className="max-w-full rounded-lg" />
        ) : (
          <div role="status" className="rounded-lg border border-border bg-muted/30 p-6 flex items-center justify-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        ))}

      {/* Task 2: prompted (visible placeholder, pre-focus on insert), never a hard validation
          gate -- FR-35 says "prompted," not "blocks insertion until filled." An empty-alt image
          still saves successfully. */}
      <input
        ref={altInputRef}
        type="text"
        value={alt}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        placeholder="Describe this image for screen readers…"
        aria-label="Image alt text"
        className="mt-1.5 w-full text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-[#BA5012] px-0.5 py-1"
      />
    </NodeViewWrapper>
  );
};
