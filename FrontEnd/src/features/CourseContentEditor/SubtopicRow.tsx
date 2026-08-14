import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Subtopic } from './useCourseContentTree';
import type { TreeMutators } from './treeMutators';
import { NodeRowShell } from './NodeRowShell';
import { EditableField } from './EditableField';
import { ExpandToggle } from './ExpandToggle';
import { ContentBlockRow } from './ContentBlockRow';

// --- Subtopic row ---

interface SubtopicRowProps {
  subtopic: Subtopic;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

export const SubtopicRow: React.FC<SubtopicRowProps> = ({ subtopic, index, siblingCount, mutators }) => {
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
