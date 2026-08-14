import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Chapter } from './useCourseContentTree';
import type { TreeMutators } from './treeMutators';
import { NodeRowShell } from './NodeRowShell';
import { EditableField } from './EditableField';
import { ExpandToggle } from './ExpandToggle';
import { TopicRow } from './TopicRow';

// --- Chapter row ---

interface ChapterRowProps {
  chapter: Chapter;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

export const ChapterRow: React.FC<ChapterRowProps> = ({ chapter, index, siblingCount, mutators }) => {
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
