import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Chapter } from './useCourseContentTree';
// AD-3's one sanctioned features/*-importing-features/* exception (Story 3.9/Task 5) -- reusing
// CoursePlayer's real components directly rather than duplicating their rendering logic, so a
// tutor's Review-as-Student preview and a real student's CoursePlayer view stay byte-for-byte
// identical by construction (Story 3.11 validates this). DrilldownPanel itself renders
// WaysMenu/ExampleCard; ContentNodeReadingPane itself renders KeywordText/KeywordPopover and
// ExerciseRunner -- both named-list components from this story's own Task 5 text arrive
// transitively through these two imports, not as four separate top-level imports.
import { ContentNodeReadingPane, findContentNode } from '../CoursePlayer/ContentNodeReadingPane';
import { DrilldownPanel } from '../CoursePlayer/DrilldownPanel';

interface ReviewAsStudentPreviewProps {
  courseId: string;
  chapters: Chapter[];
  onClose: () => void;
}

// Story 3.9/Task 5: full-surface preview ("fixed inset-0, not a modal", matching
// CourseContentEditor.tsx's own established convention -- see this story's own
// [ASSUMPTION] note), rendering the SAME course's real, currently-open content tree
// (CourseContentEditor's own useCourseContentTree data, passed in as `chapters`) through
// CoursePlayer's real components.
export const ReviewAsStudentPreview: React.FC<ReviewAsStudentPreviewProps> = ({ courseId, chapters, onClose }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeDrillTopic, setActiveDrillTopic] = useState<string | null>(null);
  const selectedNode = selectedNodeId ? findContentNode(chapters, selectedNodeId) : null;

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col" role="region" aria-label="Review as Student">
      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-5 border-b border-[#E1DED4] bg-[#FAF7EC]">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#BA5012] tracking-wider">Preview</span>
          <h2 className="text-lg font-extrabold text-[#142030]">Reviewing as Student</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit Review as Student"
          className="p-1.5 rounded-lg text-[#5E6A79] hover:bg-white hover:text-[#142030] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 flex-shrink-0 bg-white border-r border-[#E1DED4] overflow-y-auto hidden md:block">
          <div className="p-4 space-y-3">
            {chapters.map((chapter) => (
              <div key={chapter.id} className="space-y-1">
                <p className="text-xs font-bold text-[#142030] px-2 py-1">{chapter.title}</p>
                {chapter.topics.map((topic) => (
                  <div key={topic.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(topic.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedNodeId === topic.id
                          ? 'bg-[#143358]/10 text-[#143358] font-bold border border-[#143358]/20'
                          : 'text-[#5E6A79] hover:bg-[#FAF7EC]'
                      }`}
                    >
                      {topic.title}
                    </button>
                    {topic.subtopics.map((subtopic) => (
                      <button
                        type="button"
                        key={subtopic.id}
                        onClick={() => setSelectedNodeId(subtopic.id)}
                        className={`w-full text-left ml-4 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          selectedNodeId === subtopic.id
                            ? 'bg-[#143358]/10 text-[#143358] font-bold border border-[#143358]/20'
                            : 'text-[#5E6A79] hover:bg-[#FAF7EC]'
                        }`}
                      >
                        {subtopic.title}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 bg-slate-50">
          {selectedNode ? (
            <ContentNodeReadingPane key={selectedNode.id} courseId={courseId} node={selectedNode} onOpenDrilldown={setActiveDrillTopic} />
          ) : (
            <p className="text-sm text-[#5E6A79] max-w-md mx-auto text-center mt-16">
              Select a topic or subtopic on the left to preview it exactly as a student would see it.
            </p>
          )}
        </main>

        {/* Same slide-over, keyed-by-nodeId convention CoursePlayer.tsx's own DrilldownPanel
            mount already established. */}
        {activeDrillTopic && (
          <DrilldownPanel
            key={activeDrillTopic}
            courseId={courseId}
            nodeId={activeDrillTopic}
            onClose={() => setActiveDrillTopic(null)}
            onReturnToLesson={() => setActiveDrillTopic(null)}
          />
        )}
      </div>
    </div>
  );
};
