import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Topic } from './useCourseContentTree';
import type { TreeMutators } from './treeMutators';
import { NodeRowShell } from './NodeRowShell';
import { EditableField } from './EditableField';
import { ExpandToggle } from './ExpandToggle';
import { ContentBlockRow } from './ContentBlockRow';
import { SubtopicRow } from './SubtopicRow';

// --- Topic row ---

interface TopicRowProps {
  topic: Topic;
  index: number;
  siblingCount: number;
  mutators: TreeMutators;
}

export const TopicRow: React.FC<TopicRowProps> = ({ topic, index, siblingCount, mutators }) => {
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
