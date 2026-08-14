import React from 'react';
import { BookMarked, BookOpen, CheckCircle2, Layers } from 'lucide-react';
import { Course } from '../../types';
import { type Chapter as ContentChapter } from './playerContent';

interface CoursePlayerSidebarProps {
  show: boolean;
  course: Course;
  currentLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  contentChapters: ContentChapter[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// Extracted from CoursePlayer.tsx: the left syllabus sidebar, combining the legacy Module/Lesson
// accordion with the newer Chapter/Topic/Subtopic content-tree navigation (Story 3.1/Task 2).
export const CoursePlayerSidebar: React.FC<CoursePlayerSidebarProps> = ({
  show,
  course,
  currentLessonId,
  onSelectLesson,
  contentChapters,
  selectedNodeId,
  onSelectNode,
}) => {
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

      {/* Story 3.1/Task 2: real Chapter/Topic/Subtopic content-tree navigation (AC#4) --
          a separate section from the legacy Module/Lesson list above, not a replacement of it;
          selecting a node here switches the main reading pane to that node's ContentBlocks. */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center space-x-2 px-2 pb-2">
          <BookMarked className="w-4 h-4 text-[#143358]" />
          <span>Course Content</span>
        </h2>
        <div className="space-y-3">
          {contentChapters.map((chapter) => (
            <div key={chapter.id} className="space-y-1">
              <p className="text-xs font-bold text-slate-800 px-2 py-1">{chapter.title}</p>
              {chapter.topics.map((topic) => (
                <div key={topic.id} className="space-y-1">
                  <button
                    onClick={() => onSelectNode(topic.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      selectedNodeId === topic.id
                        ? 'bg-[#143358]/10 text-[#143358] font-bold border border-[#143358]/20'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {topic.title}
                  </button>
                  {topic.subtopics.map((subtopic) => (
                    <button
                      key={subtopic.id}
                      onClick={() => onSelectNode(subtopic.id)}
                      className={`w-full text-left ml-4 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedNodeId === subtopic.id
                          ? 'bg-[#143358]/10 text-[#143358] font-bold border border-[#143358]/20'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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
      </div>
    </aside>
  );
};
