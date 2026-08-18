import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileText, Layers } from 'lucide-react';
import { Course } from '../../types';
import type { OutlineDto, OutlineChapterDto, OutlineTopicDto, OutlineSubtopicDto, OutlinePageDto } from '../../services/courseContentService';
import { walkOutline } from '../../lib/outlineTraversal';

interface CoursePlayerSidebarProps {
  show: boolean;
  course: Course;
  currentLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  // Story 11.4, AC #1: replaces the flat `files`/`CourseFileDto` "Course Content" section with a
  // real Chapter -> Topic -> Sub-Topic -> Page tree -- a Published course's real navigable content
  // is the authored outline, not the raw source files (those were always an authoring-time
  // concept, per FR-18's own framing, never the long-term student-facing navigation surface).
  outline: OutlineDto | null;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
}

// A node with pages/children rendered in document order: its own Pages first, then its child
// nodes (Topics under a Chapter, Sub-Topics under a Topic) -- mirrors the same document-order
// convention Story 11.2's PreviewAsStudent.tsx already established for outline traversal.
const NodeRow: React.FC<{
  id: string;
  title: string;
  depth: number;
  pages: OutlinePageDto[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  children?: React.ReactNode;
}> = ({ id, title, depth, pages, isExpanded, onToggle, selectedPageId, onSelectPage, children }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      className="w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors"
    >
      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate">{title || 'Untitled'}</span>
    </button>
    {isExpanded && (
      <div>
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectPage(page.id)}
            style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            className={`w-full text-left flex items-center gap-2 py-1.5 pr-2 rounded-lg text-xs font-medium transition-all ${
              selectedPageId === page.id
                ? 'bg-[#143358]/10 text-[#143358] font-bold border border-[#143358]/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{page.title || 'Untitled page'}</span>
          </button>
        ))}
        {children}
      </div>
    )}
  </div>
);

const SubtopicRow: React.FC<{
  subtopic: OutlineSubtopicDto;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
}> = ({ subtopic, expanded, onToggle, selectedPageId, onSelectPage }) => (
  <NodeRow
    id={subtopic.id}
    title={subtopic.title}
    depth={2}
    pages={subtopic.pages}
    isExpanded={expanded.has(subtopic.id)}
    onToggle={() => onToggle(subtopic.id)}
    selectedPageId={selectedPageId}
    onSelectPage={onSelectPage}
  />
);

const TopicRow: React.FC<{
  topic: OutlineTopicDto;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
}> = ({ topic, expanded, onToggle, selectedPageId, onSelectPage }) => (
  <NodeRow
    id={topic.id}
    title={topic.title}
    depth={1}
    pages={topic.pages}
    isExpanded={expanded.has(topic.id)}
    onToggle={() => onToggle(topic.id)}
    selectedPageId={selectedPageId}
    onSelectPage={onSelectPage}
  >
    {topic.subtopics.map((subtopic) => (
      <SubtopicRow
        key={subtopic.id}
        subtopic={subtopic}
        expanded={expanded}
        onToggle={onToggle}
        selectedPageId={selectedPageId}
        onSelectPage={onSelectPage}
      />
    ))}
  </NodeRow>
);

const ChapterRow: React.FC<{
  chapter: OutlineChapterDto;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
}> = ({ chapter, expanded, onToggle, selectedPageId, onSelectPage }) => (
  <NodeRow
    id={chapter.id}
    title={chapter.title}
    depth={0}
    pages={chapter.pages}
    isExpanded={expanded.has(chapter.id)}
    onToggle={() => onToggle(chapter.id)}
    selectedPageId={selectedPageId}
    onSelectPage={onSelectPage}
  >
    {chapter.topics.map((topic) => (
      <TopicRow key={topic.id} topic={topic} expanded={expanded} onToggle={onToggle} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />
    ))}
  </NodeRow>
);

// Extracted from CoursePlayer.tsx: the left syllabus sidebar, combining the legacy Module/Lesson
// accordion (untouched by this story -- unrelated to this PRD) with this course's real authored
// Chapter/Topic/Sub-Topic/Page outline.
export const CoursePlayerSidebar: React.FC<CoursePlayerSidebarProps> = ({
  show,
  course,
  currentLessonId,
  onSelectLesson,
  outline,
  selectedPageId,
  onSelectPage,
}) => {
  // Defaults to every Chapter/Topic/Sub-Topic expanded (a course-scale outline is small -- NFR4
  // caps at 100 Chapters/100 Topics/50 Sub-Topics -- so starting collapsed would just add extra
  // clicks before a student can see anything at all); collapsing narrows from there. Only re-seeds
  // when the outline first arrives (or the course changes) -- never overwrites a student's own
  // subsequent expand/collapse choices.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!outline) return;
    const ids: string[] = [];
    for (const visited of walkOutline(outline.chapters)) {
      if (visited.kind === 'Page') continue;
      ids.push((visited.node as { id: string }).id);
    }
    setExpanded(new Set(ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, outline !== null]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className={`${
        show ? 'w-80' : 'w-0'
      } flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 overflow-y-auto hidden md:block`}
    >
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Course Syllabus</span>
        </h2>
      </div>

      <div className="p-3 space-y-4">
        {course.modules.map((mod) => (
          <div key={mod.id} className="space-y-1">
            <p className="text-xs font-bold text-slate-800 px-2 py-1">
              {mod.title}
            </p>
            <div className="space-y-1">
              {mod.lessons.map((lesson) => {
                const isCurrent = lesson.id === currentLessonId;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-indigo-50 text-indigo-800 font-bold border border-indigo-200/80 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {lesson.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{lesson.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1 font-semibold">
                      {lesson.durationMinutes}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Real authored Chapter/Topic/Sub-Topic/Page outline -- a separate section from the legacy
          Module/Lesson list above, not a replacement of it. */}
      {outline && outline.chapters.length > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-0.5" role="tree" aria-label="Course content">
          {outline.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              expanded={expanded}
              onToggle={toggle}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
            />
          ))}
        </div>
      )}
    </aside>
  );
};
