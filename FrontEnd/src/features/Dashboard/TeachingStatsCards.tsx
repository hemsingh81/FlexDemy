import React from 'react';

// Extracted from TutorEducatorHubView.tsx: the top row of stat cards (revenue, hours taught,
// student reach). The "New Course Wizard" trigger card that used to live here (FR-1, Story 5.1)
// moved into MyCoursesSection's header -- see that component instead.
export const TeachingStatsCards: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  );
};
