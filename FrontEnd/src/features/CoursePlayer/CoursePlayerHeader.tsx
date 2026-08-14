import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileText,
  NotebookPen,
  Sparkles,
  Star,
  Timer,
} from 'lucide-react';
import { Course, Lesson } from '../../types';

interface CoursePlayerHeaderProps {
  course: Course;
  currentLesson: Lesson;
  isScratchpadOpen: boolean;
  onBackToDashboard: () => void;
  onOpenFocusTimer: () => void;
  onOpenReviewModal: () => void;
  onToggleScratchpad: () => void;
  onOpenFlashcards: () => void;
  onOpenExportModal: () => void;
  onOpenAssignment: (assignmentId: string) => void;
  onCompleteLesson: () => void;
}

// Extracted from CoursePlayer.tsx: the sticky top navigation bar with the current lesson title
// and all of the lesson-level action buttons (focus timer, review, scratchpad, flashcards,
// export, assignment deep-link, mark-complete).
export const CoursePlayerHeader: React.FC<CoursePlayerHeaderProps> = ({
  course,
  currentLesson,
  isScratchpadOpen,
  onBackToDashboard,
  onOpenFocusTimer,
  onOpenReviewModal,
  onToggleScratchpad,
  onOpenFlashcards,
  onOpenExportModal,
  onOpenAssignment,
  onCompleteLesson,
}) => {
  // Guard the assignment button's visibility/enablement on truthiness of this local const rather
  // than asserting `currentLesson.assignment!.id` in the onClick handler below.
  const assignment = currentLesson.assignment;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onBackToDashboard}
          className="p-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
            {course.title}
          </span>
          <h1 className="text-base font-bold text-slate-900 line-clamp-1">
            {currentLesson.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto min-w-0">
        {/* Focus Session Timer Button */}
        <button
          onClick={onOpenFocusTimer}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4] transition-all cursor-pointer"
          title="Start Focus Session Timer with circular progress ring"
        >
          <Timer className="w-4 h-4 text-[#BA5012]" />
          <span className="hidden md:inline">Focus Timer</span>
        </button>

        {/* Rate & Review Course Button */}
        <button
          onClick={onOpenReviewModal}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 bg-[#FAF7EC] hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-200/80 transition-all cursor-pointer"
          title="Leave a 5-star rating & review for this course"
        >
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="hidden lg:inline">Review Course</span>
        </button>

        {/* Scratchpad Side-Panel Toggle Button */}
        <button
          onClick={onToggleScratchpad}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
            isScratchpadOpen
              ? 'bg-[#143358] text-white shadow-md'
              : 'bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4]'
          }`}
          title="Open personal lesson scratchpad & notes panel"
        >
          <NotebookPen className="w-4 h-4 text-[#BA5012]" />
          <span className="hidden sm:inline">Scratchpad Notes</span>
        </button>

        {/* AI Flashcards Button */}
        <button
          onClick={onOpenFlashcards}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-[#FAF7EC] hover:bg-[#BA5012] hover:text-white text-[#142030] font-bold text-xs rounded-xl border border-[#E1DED4] flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
          title="Generate AI Interactive Flashcards from current lesson content"
        >
          <Sparkles className="w-4 h-4 text-[#BA5012]" />
          <span className="hidden sm:inline">Generate Flashcards</span>
        </button>

        {/* Export Summary Button */}
        <button
          onClick={onOpenExportModal}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-[#FAF7EC] hover:bg-[#143358] hover:text-white text-[#142030] border border-[#E1DED4] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
          title="Export full lesson summary notes including all drilldowns and examples"
        >
          <FileText className="w-4 h-4 text-[#143358]" />
          <span className="hidden sm:inline">Export Summary</span>
        </button>

        {assignment && (
          <button
            onClick={() => onOpenAssignment(assignment.id)}
            className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
          >
            <FileCheck2 className="w-4 h-4 text-amber-600" />
            <span>Take Quiz</span>
          </button>
        )}

        <button
          onClick={onCompleteLesson}
          className="shrink-0 whitespace-nowrap px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-[#179765]" />
          <span className="hidden sm:inline">Mark Complete & Next</span>
          <span className="sm:hidden">Complete</span>
        </button>
      </div>
    </header>
  );
};
