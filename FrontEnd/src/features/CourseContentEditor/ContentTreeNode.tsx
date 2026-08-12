import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { Chapter, ContentBlock, NodeConfirmation, Subtopic, Topic } from './useCourseContentTree';
import { renderNotation } from './renderNotation';

// --- Shared editable field: local draft state, autosaves on blur (UX-DR8) ---

interface EditableFieldProps {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  lang?: string;
  ariaLabel: string;
  className?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, placeholder, multiline, lang, ariaLabel, className }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const handleBlur = () => {
    if (draft !== value) onSave(draft);
  };

  const sharedClassName =
    className ??
    'w-full text-xs bg-transparent border-b border-transparent hover:border-[#E1DED4] focus:border-[#BA5012] outline-none px-0.5 py-0.5';

  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        lang={lang}
        aria-label={ariaLabel}
        rows={2}
        className={sharedClassName}
      />
    );
  }
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      lang={lang}
      aria-label={ariaLabel}
      className={sharedClassName}
    />
  );
};

// --- Shared node-row shell: content-tree-node visual spec ---

interface NodeRowShellProps {
  nodeId: string;
  confirmation: NodeConfirmation;
  onConfirm: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
  deleteLabel: string;
  moveLabelBase: string;
  // Native HTML5 drag-and-drop reorder (AC#3/Task 5's "additional input method" alongside the
  // keyboard up/down buttons above, matching AdaptiveSchedule.tsx's drag mechanics).
  onDropNode: (draggedId: string) => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

const NodeRowShell: React.FC<NodeRowShellProps> = ({
  nodeId,
  confirmation,
  onConfirm,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDelete,
  deleteLabel,
  moveLabelBase,
  onDropNode,
  children,
  headerExtra,
}) => {
  const isConfirmed = confirmation === 'confirmed';
  return (
    <div
      data-testid={`tree-node-${nodeId}`}
      draggable
      onDragStart={(e) => {
        // Stopped from bubbling -- without this, nested draggable rows (a Content Block inside a
        // Subtopic inside a Topic) would all fire their own dragstart on the same gesture, and
        // the outermost one's setData call would silently overwrite the actually-dragged node's id.
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', nodeId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        // Stopped from bubbling for the same reason as dragstart -- otherwise a drop on a nested
        // row would also fire every ancestor row's own onDrop with the same dragged id.
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== nodeId) onDropNode(draggedId);
      }}
      className={`bg-white border rounded-xl p-3 space-y-2 cursor-move ${
        isConfirmed ? 'border-[#E1DED4] border-l-4 border-l-[#179765]' : 'border-[#E1DED4]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
        <div className="flex items-center gap-1 shrink-0">
          {headerExtra}
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              isConfirmed ? 'bg-[#179765]/10 text-[#179765]' : 'bg-slate-100 text-[#5E6A79]'
            }`}
            aria-label={isConfirmed ? 'Confirmed' : 'Not confirmed'}
          >
            {isConfirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmed}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#143358] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${moveLabelBase} up`}
            className="p-1 rounded disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${moveLabelBase} down`}
            className="p-1 rounded disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label={deleteLabel} className="p-1 rounded text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

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

const ContentBlockRow: React.FC<ContentBlockRowProps> = ({ block, index, siblingCount, onEdit, onDelete, onReorder, onMove, onConfirm }) => (
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

// --- Expand/collapse chevron (Chapter/Topic/Subtopic only) ---

const ExpandToggle: React.FC<{ isExpanded: boolean; onToggle: () => void; label: string }> = ({ isExpanded, onToggle, label }) => (
  <button type="button" onClick={onToggle} aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`} className="p-0.5 shrink-0">
    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
  </button>
);

// --- Shared mutator bundle threaded down to every level ---

export interface TreeMutators {
  addNode: (parentId: string, type: 'topic' | 'subtopic' | 'contentBlock') => void;
  editNodeTitle: (id: string, title: string) => void;
  editContentBlock: (id: string, patch: Partial<Pick<ContentBlock, 'text' | 'lang' | 'notation' | 'imageUrl' | 'altText' | 'format'>>) => void;
  deleteNode: (id: string) => void;
  reorderNode: (id: string, direction: 'up' | 'down') => void;
  moveNode: (draggedId: string, targetId: string) => void;
  confirmNode: (id: string) => void;
  // Chapter/Topic/Subtopic deletes route through this instead of deleteNode directly, so
  // CourseContentEditor.tsx can open ConfirmModal first (cascading, destructive).
  requestDelete: (id: string, label: string) => void;
}

// --- Subtopic row ---

interface SubtopicRowProps {
  subtopic: Subtopic;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

const SubtopicRow: React.FC<SubtopicRowProps> = ({ subtopic, index, siblingCount, mutators }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <NodeRowShell
      nodeId={subtopic.id}
      confirmation={subtopic.confirmation}
      onConfirm={() => mutators.confirmNode(subtopic.id)}
      onMoveUp={() => mutators.reorderNode(subtopic.id, 'up')}
      onMoveDown={() => mutators.reorderNode(subtopic.id, 'down')}
      canMoveUp={index > 0}
      canMoveDown={index < siblingCount - 1}
      onDelete={() => mutators.requestDelete(subtopic.id, subtopic.title)}
      deleteLabel={`Delete subtopic: ${subtopic.title}`}
      moveLabelBase={`subtopic: ${subtopic.title}`}
      onDropNode={(draggedId) => mutators.moveNode(draggedId, subtopic.id)}
      headerExtra={
        <button
          type="button"
          onClick={() => mutators.addNode(subtopic.id, 'contentBlock')}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] border border-[#E1DED4] text-[#142030]"
        >
          <Plus className="w-3 h-3 inline" /> Content Block
        </button>
      }
    >
      <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} label={`subtopic: ${subtopic.title}`} />
      <EditableField
        value={subtopic.title}
        onSave={(next) => mutators.editNodeTitle(subtopic.id, next)}
        ariaLabel={`Subtopic ${index + 1} title`}
        className="flex-1 min-w-0 text-xs font-bold bg-transparent border-b border-transparent hover:border-[#E1DED4] focus:border-[#BA5012] outline-none"
      />
      {isExpanded && subtopic.contentBlocks.length > 0 && (
        <div className="ml-6 mt-2 space-y-2 w-full">
          {subtopic.contentBlocks.map((block, i) => (
            <ContentBlockRow
              key={block.id}
              block={block}
              index={i}
              siblingCount={subtopic.contentBlocks.length}
              onEdit={mutators.editContentBlock}
              onDelete={mutators.deleteNode}
              onReorder={mutators.reorderNode}
              onMove={mutators.moveNode}
              onConfirm={mutators.confirmNode}
            />
          ))}
        </div>
      )}
    </NodeRowShell>
  );
};

// --- Topic row ---

interface TopicRowProps {
  topic: Topic;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

const TopicRow: React.FC<TopicRowProps> = ({ topic, index, siblingCount, mutators }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <NodeRowShell
      nodeId={topic.id}
      confirmation={topic.confirmation}
      onConfirm={() => mutators.confirmNode(topic.id)}
      onMoveUp={() => mutators.reorderNode(topic.id, 'up')}
      onMoveDown={() => mutators.reorderNode(topic.id, 'down')}
      canMoveUp={index > 0}
      canMoveDown={index < siblingCount - 1}
      onDelete={() => mutators.requestDelete(topic.id, topic.title)}
      deleteLabel={`Delete topic: ${topic.title}`}
      moveLabelBase={`topic: ${topic.title}`}
      onDropNode={(draggedId) => mutators.moveNode(draggedId, topic.id)}
      headerExtra={
        <>
          <button
            type="button"
            onClick={() => mutators.addNode(topic.id, 'subtopic')}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] border border-[#E1DED4] text-[#142030]"
          >
            <Plus className="w-3 h-3 inline" /> Subtopic
          </button>
          <button
            type="button"
            onClick={() => mutators.addNode(topic.id, 'contentBlock')}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] border border-[#E1DED4] text-[#142030]"
          >
            <Plus className="w-3 h-3 inline" /> Content Block
          </button>
        </>
      }
    >
      <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} label={`topic: ${topic.title}`} />
      <EditableField
        value={topic.title}
        onSave={(next) => mutators.editNodeTitle(topic.id, next)}
        ariaLabel={`Topic ${index + 1} title`}
        className="flex-1 min-w-0 text-sm font-bold bg-transparent border-b border-transparent hover:border-[#E1DED4] focus:border-[#BA5012] outline-none"
      />
      {isExpanded && (
        <div className="ml-6 mt-2 space-y-2 w-full">
          {topic.contentBlocks.map((block, i) => (
            <ContentBlockRow
              key={block.id}
              block={block}
              index={i}
              siblingCount={topic.contentBlocks.length}
              onEdit={mutators.editContentBlock}
              onDelete={mutators.deleteNode}
              onReorder={mutators.reorderNode}
              onMove={mutators.moveNode}
              onConfirm={mutators.confirmNode}
            />
          ))}
          {topic.subtopics.map((subtopic, i) => (
            <SubtopicRow key={subtopic.id} subtopic={subtopic} index={i} siblingCount={topic.subtopics.length} mutators={mutators} />
          ))}
        </div>
      )}
    </NodeRowShell>
  );
};

// --- Chapter row ---

interface ChapterRowProps {
  chapter: Chapter;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

const ChapterRow: React.FC<ChapterRowProps> = ({ chapter, index, siblingCount, mutators }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <NodeRowShell
      nodeId={chapter.id}
      confirmation={chapter.confirmation}
      onConfirm={() => mutators.confirmNode(chapter.id)}
      onMoveUp={() => mutators.reorderNode(chapter.id, 'up')}
      onMoveDown={() => mutators.reorderNode(chapter.id, 'down')}
      canMoveUp={index > 0}
      canMoveDown={index < siblingCount - 1}
      onDelete={() => mutators.requestDelete(chapter.id, chapter.title)}
      deleteLabel={`Delete chapter: ${chapter.title}`}
      moveLabelBase={`chapter: ${chapter.title}`}
      onDropNode={(draggedId) => mutators.moveNode(draggedId, chapter.id)}
      headerExtra={
        <button
          type="button"
          onClick={() => mutators.addNode(chapter.id, 'topic')}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAF7EC] border border-[#E1DED4] text-[#142030]"
        >
          <Plus className="w-3 h-3 inline" /> Topic
        </button>
      }
    >
      <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} label={`chapter: ${chapter.title}`} />
      <EditableField
        value={chapter.title}
        onSave={(next) => mutators.editNodeTitle(chapter.id, next)}
        ariaLabel={`Chapter ${index + 1} title`}
        className="flex-1 min-w-0 text-sm font-extrabold bg-transparent border-b border-transparent hover:border-[#E1DED4] focus:border-[#BA5012] outline-none"
      />
      {isExpanded && (
        <div className="ml-6 mt-2 space-y-2 w-full">
          {chapter.topics.map((topic, i) => (
            <TopicRow key={topic.id} topic={topic} index={i} siblingCount={chapter.topics.length} mutators={mutators} />
          ))}
        </div>
      )}
    </NodeRowShell>
  );
};

// --- Top-level tree ---

interface ContentTreeProps {
  chapters: Chapter[];
  mutators: TreeMutators;
  onAddChapter: () => void;
}

export const ContentTree: React.FC<ContentTreeProps> = ({ chapters, mutators, onAddChapter }) => (
  <div className="space-y-3">
    {chapters.map((chapter, i) => (
      <ChapterRow key={chapter.id} chapter={chapter} index={i} siblingCount={chapters.length} mutators={mutators} />
    ))}
    <button
      type="button"
      onClick={onAddChapter}
      className="w-full p-3 rounded-xl border-2 border-dashed border-[#E1DED4] flex items-center justify-center gap-2 text-[#5E6A79] hover:border-[#BA5012] hover:text-[#BA5012] transition-colors text-xs font-bold"
    >
      <Plus className="w-4 h-4" />
      <span>Add Chapter</span>
    </button>
  </div>
);
