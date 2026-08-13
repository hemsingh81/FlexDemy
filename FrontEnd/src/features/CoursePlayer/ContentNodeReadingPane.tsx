import React from 'react';
import { Sparkles as SparklesIcon } from 'lucide-react';
import { renderNotation } from '../CourseContentEditor/renderNotation';
import { MOCK_BLOCK_KEYWORDS, type Chapter, type ContentBlock } from './playerContent';
import { useKeywordDefinition } from './useKeywordDefinition';
import { KeywordText } from './KeywordText';
import { ExerciseRunner } from './ExerciseRunner';

// Story 3.9/Task 5: extracted from CoursePlayer.tsx's own inline selectedContentNode rendering
// (Story 3.1/Task 2) so it can be reused, not duplicated, by CourseContentEditor's Review-as-
// Student preview -- AD-3's own "do not duplicate them" instruction. CoursePlayer.tsx itself now
// renders this same component for its own real-student view; both call sites stay byte-for-byte
// identical by construction (Story 3.11 validates this).
export interface SelectedContentNode {
  id: string;
  title: string;
  contentBlocks: ContentBlock[];
}

export const findContentNode = (chapters: Chapter[], nodeId: string): SelectedContentNode | null => {
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      if (topic.id === nodeId) return topic;
      for (const subtopic of topic.subtopics) {
        if (subtopic.id === nodeId) return subtopic;
      }
    }
  }
  return null;
};

interface ContentBlockViewProps {
  block: ContentBlock;
  keywordState: ReturnType<typeof useKeywordDefinition>;
}

const ContentBlockView: React.FC<ContentBlockViewProps> = ({ block, keywordState }) => {
  if (block.format === 'text') {
    return (
      <KeywordText
        text={block.text ?? ''}
        keywords={MOCK_BLOCK_KEYWORDS[block.id] ?? []}
        lang={block.lang}
        activeKeyword={keywordState.activeKeyword}
        definition={keywordState.definition}
        isOverridden={keywordState.isOverridden}
        isLoading={keywordState.isLoading}
        onDefine={keywordState.define}
        onDismiss={keywordState.dismiss}
      />
    );
  }
  if (block.format === 'math') {
    return (
      <div
        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center overflow-x-auto"
        // Story 3.11/Task 3: stable selector for the golden-file visual-parity suite -- a test
        // hook only, doesn't affect rendering/behavior.
        data-testid={`student-rendered-notation-${block.id}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderNotation(block.notation ?? '') }}
      />
    );
  }
  if (block.format === 'image' && block.imageUrl) {
    return <img src={block.imageUrl} alt={block.altText ?? ''} className="max-w-full rounded-xl" />;
  }
  return null;
};

interface ContentNodeReadingPaneProps {
  courseId: string;
  node: SelectedContentNode;
  onOpenDrilldown: (nodeId: string) => void;
}

// Callers should render this keyed by `node.id` (`<ContentNodeReadingPane key={node.id} .../>`) --
// same established idiom this epic's own code-review fixes repeatedly applied (Stories 3.1-3.3)
// for resetting local per-node state (here, the fresh useKeywordDefinition instance below) on a
// node switch, rather than an extra effect manually calling dismiss().
export const ContentNodeReadingPane: React.FC<ContentNodeReadingPaneProps> = ({ courseId, node, onOpenDrilldown }) => {
  // Story 3.2/Task 4: a single shared instance -- only one keyword definition is ever in flight
  // at a time (FR20), so every ContentBlockView in this reading pane reads/drives the same state.
  const keywordState = useKeywordDefinition(courseId);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{node.title}</h2>
        <button
          type="button"
          onClick={() => onOpenDrilldown(node.id)}
          className="px-3 py-1.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>Open Drill-Down</span>
        </button>
      </div>
      <div className="space-y-4">
        {node.contentBlocks.map((block) => (
          <ContentBlockView key={block.id} block={block} keywordState={keywordState} />
        ))}
      </div>
      <ExerciseRunner courseId={courseId} nodeId={node.id} />
    </div>
  );
};
