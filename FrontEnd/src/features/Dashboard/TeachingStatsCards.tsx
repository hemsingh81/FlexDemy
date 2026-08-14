import React from 'react';
import { Plus } from 'lucide-react';

interface TeachingStatsCardsProps {
  isContentEditorOpen: boolean;
  onOpenNewCourseWizard: () => void;
}

// Extracted from TutorEducatorHubView.tsx: the top row of stat cards (revenue, hours taught,
// student reach) plus the "New Course Wizard" trigger card.
export const TeachingStatsCards: React.FC<TeachingStatsCardsProps> = ({
  isContentEditorOpen,
  onOpenNewCourseWizard,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1">
        <p className="text-xs text-[#5E6A79] font-medium">Total Teaching Revenue</p>
        <p className="text-2xl font-bold font-display text-[#BA5012]">$4,650.00</p>
        <p className="text-[10px] text-[#179765] font-semibold">↑ +18% this month</p>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1">
        <p className="text-xs text-[#5E6A79] font-medium">Hours Taught</p>
        <p className="text-2xl font-bold font-display text-[#142030]">64.5 hrs</p>
        <p className="text-[10px] text-[#5E6A79]">Avg 4.5 hrs/week</p>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1">
        <p className="text-xs text-[#5E6A79] font-medium">Student Reach</p>
        <p className="text-2xl font-bold font-display text-[#142030]">175 Students</p>
        <p className="text-[10px] text-[#179765] font-semibold">4.95 ★ Average Rating</p>
      </div>

      <div id="course-publishing" className="scroll-mt-24 p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1 flex flex-col justify-between">
        <p className="text-xs text-[#5E6A79] font-medium">Course Creation</p>
        <button
          onClick={onOpenNewCourseWizard}
          // Disabled while Course Content Editor is open -- otherwise this stays keyboard-
          // reachable and a second CourseWizard session could open on top of it.
          disabled={isContentEditorOpen}
          className="w-full py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>New Course Wizard</span>
        </button>
      </div>
    </div>
  );
};
