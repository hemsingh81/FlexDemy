import React from 'react';
import type { ContentBlock } from './useCourseContentTree';
import { renderNotation } from './renderNotation';
import { EditableField } from './EditableField';
import { NodeRowShell } from './NodeRowShell';

// --- Content Block row (leaf) ---

interface ContentBlockRowProps {
  block: ContentBlock;
  index: number;
  siblingCount: number;
  onEdit: (id: string, patch: Partial<Pick<ContentBlock, 'text' | 'lang' | 'notation' | 'imageUrl' | 'altText' | 'format'>>) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onMove: (draggedId: string, targetId: string) => void;
  onConfirm: (id: string) => void;
}

// Story 2.10/Task 4: the only format conversion this control supports is Text<->Math -- Image
// blocks aren't produced by anything in this pipeline yet (AddContentBlockAsync always creates
// Text; extraction never proposes "image"), so the toggle only renders for the two formats a
// tutor can actually reach. Lossy in both directions -- nothing requires preserving content
// across a format change (Story 2.9's own Task 2 Dev Notes).
const FormatToggle: React.FC<{ block: ContentBlock; index: number; onEdit: ContentBlockRowProps['onEdit'] }> = ({ block, index, onEdit }) => (
  <div className="flex items-center gap-1" role="group" aria-label={`Content block ${index + 1} format`}>
    <button
      type="button"
      onClick={() => block.format !== 'text' && onEdit(block.id, { format: 'text', notation: '', altText: '' })}
      aria-pressed={block.format === 'text'}
      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
        block.format === 'text' ? 'bg-[#143358] text-white' : 'bg-slate-100 text-[#5E6A79]'
      }`}
    >
      Text
    </button>
    <button
      type="button"
      // Code-review patch: clearing `text` as a side effect of the format conversion would
      // otherwise be indistinguishable from a genuine text edit to the backend's auto-detect
      // suppression logic (which keys off "was 'lang' also touched in this request"), silently
      // discarding a Hindi block's lang="hi" tag (DetectsHindi('') is always false). Explicitly
      // touching `lang` with its current value preserves it through the conversion.
      onClick={() => block.format !== 'math' && onEdit(block.id, { format: 'math', text: '', lang: block.lang })}
      aria-pressed={block.format === 'math'}
      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
        block.format === 'math' ? 'bg-[#143358] text-white' : 'bg-slate-100 text-[#5E6A79]'
      }`}
    >
      Math
    </button>
  </div>
);

export const ContentBlockRow: React.FC<ContentBlockRowProps> = ({ block, index, siblingCount, onEdit, onDelete, onReorder, onMove, onConfirm }) => (
  <NodeRowShell
    nodeId={block.id}
    confirmation={block.confirmation}
    onConfirm={() => onConfirm(block.id)}
    onMoveUp={() => onReorder(block.id, 'up')}
    onMoveDown={() => onReorder(block.id, 'down')}
    canMoveUp={index > 0}
    canMoveDown={index < siblingCount - 1}
    onDelete={() => onDelete(block.id)}
    deleteLabel={`Delete content block ${index + 1}`}
    moveLabelBase={`content block ${index + 1}`}
    onDropNode={(draggedId) => onMove(draggedId, block.id)}
  >
    <div className="flex-1 min-w-0 space-y-1">
      {(block.format === 'text' || block.format === 'math') && <FormatToggle block={block} index={index} onEdit={onEdit} />}
      {block.format === 'text' && (
        <EditableField
          value={block.text ?? ''}
          onSave={(next) => onEdit(block.id, { text: next })}
          multiline
          lang={block.lang}
          ariaLabel={`Content block ${index + 1} text`}
        />
      )}
      {block.format === 'math' && (
        <>
          <EditableField
            value={block.notation ?? ''}
            onSave={(next) => onEdit(block.id, { notation: next })}
            ariaLabel={`Content block ${index + 1} notation`}
          />
          <div
            role="img"
            // Code-review patch: a whitespace-only altText (e.g. spaces typed then blurred) is
            // truthy in JS, so `|| undefined` alone doesn't omit it -- trim first.
            aria-label={block.altText?.trim() || undefined}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center overflow-x-auto"
            data-testid={`rendered-notation-${block.id}`}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderNotation(block.notation ?? '') }}
          />
          <EditableField
            value={block.altText ?? ''}
            onSave={(next) => onEdit(block.id, { altText: next })}
            placeholder="Alt text (auto-generated, editable)"
            ariaLabel={`Content block ${index + 1} alt text`}
          />
        </>
      )}
      {block.format === 'image' && (
        <div className="space-y-1">
          <EditableField
            value={block.imageUrl ?? ''}
            onSave={(next) => onEdit(block.id, { imageUrl: next })}
            placeholder="Image URL"
            ariaLabel={`Content block ${index + 1} image URL`}
          />
          <EditableField
            value={block.altText ?? ''}
            onSave={(next) => onEdit(block.id, { altText: next })}
            placeholder="Alt text"
            ariaLabel={`Content block ${index + 1} alt text`}
          />
          {block.imageUrl && <img src={block.imageUrl} alt={block.altText ?? ''} className="max-w-full rounded-lg" />}
        </div>
      )}
    </div>
  </NodeRowShell>
);
