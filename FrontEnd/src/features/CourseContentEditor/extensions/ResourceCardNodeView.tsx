// Story 9.2, Task 3: a picker over the page's own already-attached Learning Resources block
// entries (Story 8.1's getResourcesByOwner) when no resource is chosen yet, or once "Change" is
// clicked; otherwise a real download-card link resolving through resolveResourceUrl (Story 8.3).
import React, { useCallback, useEffect, useState } from 'react';
import type { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Paperclip } from 'lucide-react';
import { getResourcesByOwner, resolveResourceUrl, type ResourceDto } from '../../../services/courseContentService';
import { useResolvedResourceUrl } from '../../../hooks/useResolvedResourceUrl';
import type { ContentOwnerType } from '../../../types';

export const ResourceCardNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, extension }) => {
  const courseId = (extension.options as { courseId: string }).courseId;
  const resourceId = node.attrs.resourceId as string | null;
  const label = (node.attrs.label as string) ?? '';
  const ownerType = node.attrs.ownerType as ContentOwnerType | null;
  const ownerId = node.attrs.ownerId as string | null;

  const [pickerOpen, setPickerOpen] = useState(!resourceId);
  const [options, setOptions] = useState<ResourceDto[]>([]);

  useEffect(() => {
    if (!pickerOpen || !ownerType || !ownerId) return;
    getResourcesByOwner(courseId, ownerType, ownerId)
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [pickerOpen, courseId, ownerType, ownerId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolve = useCallback((id: string) => resolveResourceUrl(courseId, id), [courseId]);
  // Preserves this component's own pre-extraction behavior exactly: a resolve failure leaves
  // `href` null (renders as an anchor with no href) rather than a distinct failed state --
  // `failed` is deliberately unused here.
  const { url: href } = useResolvedResourceUrl(resolve, resourceId);

  const choose = (resource: ResourceDto) => {
    updateAttributes({ resourceId: resource.id, label: resource.label });
    setPickerOpen(false);
  };

  if (!resourceId || pickerOpen) {
    return (
      <NodeViewWrapper className="my-3 rounded-lg border border-border bg-card p-3" contentEditable={false}>
        <p className="text-xs font-bold text-foreground mb-2">Choose a resource already attached to this page</p>
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No resources attached to this page yet -- add one via the Learning Resources block first.
          </p>
        )}
        <ul role="listbox" aria-label="Choose a resource" className="flex flex-col gap-1">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => choose(option)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/60 text-foreground"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-2" contentEditable={false}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E1DED4] bg-[#F3F0E6] text-sm font-semibold text-foreground">
        <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 no-underline text-foreground flex-1 min-w-0">
          <Paperclip className="w-4 h-4 text-[#BA5012] shrink-0" />
          <span className="truncate">{label}</span>
        </a>
        <button type="button" onClick={() => setPickerOpen(true)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline">
          Change
        </button>
      </div>
    </NodeViewWrapper>
  );
};
