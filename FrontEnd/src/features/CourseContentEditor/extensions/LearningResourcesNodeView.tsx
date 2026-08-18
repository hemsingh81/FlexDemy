// Story 8.1: the Learning Resources block's own interactive UI (DESIGN.md's content-resource-block
// token) -- a real role <select>, an inline-editable label/caption, remove and reorder icon
// buttons, and a drop-zone offering real Upload / Attach-existing button-row controls alongside
// drag-and-drop (never drag-only, UX-DR10). "Insert-from-file" is Epic 10's own feature and is
// deliberately omitted here rather than faked as a disabled control (Task 6's own instruction).
import React, { useEffect, useRef, useState } from 'react';
import type { Editor, NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { ArrowDown, ArrowUp, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { ConfirmModal } from '../../../ui/ConfirmModal';
import { getFiles, type CourseFileDto } from '../../../services/courseFileService';
import {
  attachExistingFileAsResource,
  deleteResource,
  getResourcesByOwner,
  reorderResource,
  updateResource,
  uploadResource,
  CourseContentError,
  type ResourceDto,
} from '../../../services/courseContentService';
import type { InheritedResourceEntry } from '../resolveInheritedResources';
import type { ContentOwnerType } from '../../../types';

// Matches useFileUpload.ts's own FILE_POLL_INTERVAL_MS precedent -- same tunable-timing,
// named-constant convention.
const RESOURCE_POLL_INTERVAL_MS = 3000;

const OWNER_LABEL: Record<ContentOwnerType, string> = {
  Chapter: 'this chapter',
  Topic: 'this topic',
  Subtopic: 'this sub-topic',
  Page: 'this page',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  queued: 'bg-[#143358] text-white',
  done: 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20',
  failed: 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20',
};

const isImageContentType = (contentType: string) => contentType.toLowerCase().startsWith('image/');

const defaultRoleFor = (contentType: string): 'Inline' | 'Attachment' => (isImageContentType(contentType) ? 'Inline' : 'Attachment');

// Story 8.2, Task 3: "Navigates to" an inherited row's ancestor means moving REAL DOM focus to
// that ancestor's own heading -- reuses TableOfContentsRail.tsx's own mechanism (tabindex="-1" +
// .focus(), found via editor.view.nodeDOM at the heading's ProseMirror position) rather than a
// second navigation mechanism for this one link type.
const focusAncestorHeading = (editor: Editor, ownerType: ContentOwnerType, ownerId: string) => {
  let targetPos: number | null = null;
  editor.state.doc.descendants((docNode, pos) => {
    if (targetPos !== null || docNode.type.name !== 'heading') return targetPos === null;
    const level = docNode.attrs.level as number;
    if (
      (ownerType === 'Chapter' && level === 1) ||
      (ownerType === 'Topic' && level === 2 && docNode.attrs.entityId === ownerId) ||
      (ownerType === 'Subtopic' && level === 3 && docNode.attrs.entityId === ownerId)
    ) {
      targetPos = pos;
    }
    return targetPos === null;
  });
  if (targetPos === null) return;
  const dom = editor.view.nodeDOM(targetPos) as HTMLElement | null;
  if (!dom) return;
  if (!dom.hasAttribute('tabindex')) dom.setAttribute('tabindex', '-1');
  dom.focus();
  // jsdom doesn't implement scrollIntoView at all -- guarded rather than assumed, same posture
  // as this codebase's other jsdom-gap workarounds (elementFromPoint, getClientRects).
  dom.scrollIntoView?.({ block: 'center' });
};

const ANCESTOR_LABEL: Record<ContentOwnerType, string> = {
  Chapter: 'Chapter',
  Topic: 'Topic',
  Subtopic: 'Sub-Topic',
  Page: 'Page',
};

export const LearningResourcesNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, extension, editor }) => {
  const courseId = (extension.options as { courseId: string }).courseId;
  const ownerType = node.attrs.ownerType as ContentOwnerType | null;
  const ownerId = node.attrs.ownerId as string | null;
  const resources = (node.attrs.resources as ResourceDto[] | undefined) ?? [];
  const inherited = (node.attrs.inherited as InheritedResourceEntry[] | undefined) ?? [];

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachableFiles, setAttachableFiles] = useState<CourseFileDto[]>([]);
  // Story 8.3, AC #2/Task 4: set only when a plain delete comes back 409 (delete-in-use) --
  // replaces the (already-happened) optimistic-remove/rollback with an explicit two-action
  // choice, never a single generic "delete failed" toast that loses the tutor's original intent.
  const [deleteConflict, setDeleteConflict] = useState<{ resource: ResourceDto; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setResources = (next: ResourceDto[]) => updateAttributes({ resources: next });

  const sorted = [...resources].sort((a, b) => a.order - b.order);

  // Story 8.1-8.3: the six mutation handlers below all repeat the same shape -- optimistically
  // apply `next`, call the server, and roll back to the pre-optimistic state on failure.
  // Centralized here so a future 7th mutation doesn't hand-roll an 8th copy, and the rollback
  // itself can't drift between call sites. `onFailure` lets a call site (handleRemove's 409
  // delete-in-use branch) fully own a specific failure shape instead of the generic error message
  // -- returning `true` skips it, `false`/undefined falls through to the generic message.
  const withOptimisticUpdate = (
    next: ResourceDto[],
    apiCall: () => Promise<unknown>,
    options: { fallbackMessage: string; onFailure?: (error: unknown) => boolean }
  ) => {
    const previous = resources;
    setResources(next);
    apiCall().catch((e) => {
      setResources(previous);
      if (options.onFailure?.(e)) return;
      setError(e instanceof Error ? e.message : options.fallbackMessage);
    });
  };

  // Polls while any resource is still Queued (the async malware-scan/SVG-sanitize job hasn't
  // finished) -- mirrors useFileUpload.ts's own poll-while-non-terminal pattern, since a
  // Resource's Status transitions (Queued -> Done/Failed) have no other push mechanism here.
  useEffect(() => {
    const hasQueued = resources.some((r) => r.status.toLowerCase() === 'queued');
    if (!ownerType || !ownerId || !hasQueued) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }
    if (pollTimerRef.current) return undefined;
    pollTimerRef.current = setInterval(() => {
      getResourcesByOwner(courseId, ownerType, ownerId)
        .then((fresh) => setResources(fresh))
        .catch(() => undefined);
    }, RESOURCE_POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, ownerType, ownerId, courseId]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const handleFiles = (files: File[]) => {
    if (!ownerType || !ownerId || files.length === 0) return;
    setError(null);
    setIsUploading(true);
    Promise.all(
      files.map((file) =>
        uploadResource(courseId, ownerType, ownerId, file, { label: file.name, role: defaultRoleFor(file.type) })
      )
    )
      .then((created) => setResources([...resources, ...created]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not upload this file. Please try again.'))
      .finally(() => setIsUploading(false));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
    e.target.value = '';
  };

  const openAttachMenu = () => {
    if (!ownerType || !ownerId) return;
    setAttachMenuOpen(true);
    getFiles(courseId)
      .then((files) => setAttachableFiles(files.filter((f) => f.status.toLowerCase() === 'done')))
      .catch(() => setAttachableFiles([]));
  };

  const handleAttachExisting = (file: CourseFileDto) => {
    if (!ownerType || !ownerId) return;
    setAttachMenuOpen(false);
    setError(null);
    attachExistingFileAsResource(courseId, ownerType, ownerId, file.id, defaultRoleFor(file.contentType))
      .then((created) => setResources([...resources, created]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not attach this file. Please try again.'));
  };

  const handleRoleChange = (resource: ResourceDto, role: 'Inline' | 'Attachment' | 'Both') => {
    withOptimisticUpdate(
      resources.map((r) => (r.id === resource.id ? { ...r, role } : r)),
      () => updateResource(courseId, resource.id, { label: resource.label, caption: resource.caption, role }),
      { fallbackMessage: 'Could not update this resource. Please try again.' }
    );
  };

  const commitLabel = (resource: ResourceDto, label: string) => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === resource.label) return;
    withOptimisticUpdate(
      resources.map((r) => (r.id === resource.id ? { ...r, label: trimmed } : r)),
      () => updateResource(courseId, resource.id, { label: trimmed, caption: resource.caption, role: resource.role }),
      { fallbackMessage: 'Could not update this resource. Please try again.' }
    );
  };

  const commitCaption = (resource: ResourceDto, caption: string) => {
    const trimmed = caption.trim();
    const normalized = trimmed.length === 0 ? null : trimmed;
    if (normalized === resource.caption) return;
    withOptimisticUpdate(
      resources.map((r) => (r.id === resource.id ? { ...r, caption: normalized } : r)),
      () => updateResource(courseId, resource.id, { label: resource.label, caption: normalized, role: resource.role }),
      { fallbackMessage: 'Could not update this resource. Please try again.' }
    );
  };

  const handleRemove = (resource: ResourceDto) => {
    withOptimisticUpdate(
      resources.filter((r) => r.id !== resource.id),
      () => deleteResource(courseId, resource.id),
      {
        fallbackMessage: 'Could not remove this resource. Please try again.',
        // A 409 means the backend found at least one referencing page and named it in the
        // message -- offer the explicit two-action choice (Task 4) instead of a plain error.
        onFailure: (e) => {
          if (e instanceof CourseContentError && e.status === 409) {
            setDeleteConflict({ resource, message: e.message });
            return true;
          }
          return false;
        },
      }
    );
  };

  const handleForceRemoveFromContent = () => {
    if (!deleteConflict) return;
    const { resource } = deleteConflict;
    setDeleteConflict(null);
    withOptimisticUpdate(resources.filter((r) => r.id !== resource.id), () => deleteResource(courseId, resource.id, true), {
      fallbackMessage: 'Could not remove this resource. Please try again.',
    });
  };

  const handleReorder = (resource: ResourceDto, direction: 'up' | 'down') => {
    const index = sorted.findIndex((r) => r.id === resource.id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= sorted.length) return; // boundary no-op

    const reordered = [...sorted];
    const currentOrder = reordered[index].order;
    reordered[index] = { ...reordered[index], order: reordered[swapWith].order };
    reordered[swapWith] = { ...reordered[swapWith], order: currentOrder };

    withOptimisticUpdate(reordered, () => reorderResource(courseId, resource.id, direction), {
      fallbackMessage: 'Could not reorder this resource. Please try again.',
    });
  };

  return (
    <NodeViewWrapper
      data-learning-resources-block=""
      className="my-4 rounded-lg border border-border bg-[#F3F0E6] p-4"
      contentEditable={false}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-foreground" />
          <span className="text-sm font-bold text-foreground">Learning Resources</span>
        </div>
        <span className="text-xs text-muted-foreground">Attached to {ownerType ? OWNER_LABEL[ownerType] : 'this item'}</span>
      </div>

      {error && (
        <p role="alert" className="mb-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2 mb-3">
        {sorted.map((resource, index) => (
          <li key={resource.id} className="flex flex-col gap-1 rounded-lg border border-border bg-white px-3 py-2">
            <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label={`Label for ${resource.fileName}`}
              defaultValue={resource.label}
              onBlur={(e) => commitLabel(resource, e.target.value)}
              className="min-w-0 flex-1 text-sm font-semibold text-foreground bg-transparent focus:outline-none focus:ring-2 focus:ring-[#BA5012] rounded px-1"
            />
            <input
              type="text"
              aria-label={`Caption for ${resource.fileName}`}
              placeholder="Add a caption…"
              defaultValue={resource.caption ?? ''}
              onBlur={(e) => commitCaption(resource, e.target.value)}
              className="min-w-0 flex-1 text-xs text-muted-foreground bg-transparent focus:outline-none focus:ring-2 focus:ring-[#BA5012] rounded px-1"
            />
            <select
              aria-label={`Role for ${resource.fileName}`}
              value={resource.role}
              onChange={(e) => handleRoleChange(resource, e.target.value as 'Inline' | 'Attachment' | 'Both')}
              className="text-xs px-2 py-1 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            >
              <option value="Inline">Inline</option>
              <option value="Attachment">Attachment</option>
              <option value="Both">Both</option>
            </select>
            <span
              className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[resource.status.toLowerCase()] ?? STATUS_BADGE_CLASSES.queued}`}
              title={resource.status.toLowerCase() === 'failed' ? (resource.failureReason ?? undefined) : undefined}
            >
              {resource.status.toLowerCase() === 'queued' && <Spinner size="xs" className="text-white" />}
              {resource.status}
            </span>
            <button
              type="button"
              aria-label={`Move ${resource.label} up`}
              disabled={index === 0}
              onClick={() => handleReorder(resource, 'up')}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Move ${resource.label} down`}
              disabled={index === sorted.length - 1}
              onClick={() => handleReorder(resource, 'down')}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${resource.label}`}
              onClick={() => handleRemove(resource)}
              className="p-1 rounded text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
            {resource.status.toLowerCase() === 'failed' && resource.failureReason && (
              <p className="text-[11px] text-destructive px-1">{resource.failureReason}</p>
            )}
          </li>
        ))}
      </ul>

      {inherited.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Inherited</p>
          <ul className="flex flex-col gap-2">
            {inherited.map((entry) => (
              <li
                key={`${entry.ancestorOwnerType}-${entry.id}`}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-white/50 px-3 py-2 opacity-70"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-muted-foreground truncate">{entry.label}</span>
                {entry.caption && <span className="min-w-0 flex-1 text-xs text-muted-foreground truncate">{entry.caption}</span>}
                <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {entry.role}
                </span>
                {/* A real focusable link, never plain descriptive text -- DESIGN.md's
                    content-resource-block.resourceRowControls's explicit requirement for an
                    inherited row's "Manage on X" affordance. */}
                <button
                  type="button"
                  onClick={() => focusAncestorHeading(editor, entry.ancestorOwnerType, entry.ancestorOwnerId)}
                  className="shrink-0 text-xs font-semibold text-[#BA5012] underline hover:text-[#8f3d0e]"
                >
                  Manage on {entry.ancestorTitle || ANCESTOR_LABEL[entry.ancestorOwnerType]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed p-3 flex items-center justify-between gap-2 ${
          isDraggingOver ? 'border-[#BA5012] bg-[#BA5012]/5' : 'border-[#E1DED4]'
        }`}
      >
        <span className="text-xs text-muted-foreground">Drag and drop files here, or:</span>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" multiple onChange={handleFilePicked} className="hidden" aria-hidden="true" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-foreground bg-white border border-border rounded-lg hover:border-[#BA5012] disabled:opacity-50"
          >
            {isUploading ? <Spinner size="xs" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={openAttachMenu}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-foreground bg-white border border-border rounded-lg hover:border-[#BA5012]"
            >
              <Plus className="w-3.5 h-3.5" />
              Attach existing
            </button>
            {attachMenuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground">Attach existing file</span>
                  <button type="button" onClick={() => setAttachMenuOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                    Close
                  </button>
                </div>
                <ul role="listbox" aria-label="Attach existing file" className="max-h-60 overflow-y-auto py-1">
                  {attachableFiles.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No files available</li>}
                  {attachableFiles.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => handleAttachExisting(file)}
                        className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 truncate"
                      >
                        {file.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConflict && (
        <ConfirmModal
          message={deleteConflict.message}
          confirmLabel="Remove from content and delete"
          cancelLabel="Cancel"
          onConfirm={handleForceRemoveFromContent}
          onCancel={() => setDeleteConflict(null)}
        />
      )}
    </NodeViewWrapper>
  );
};
