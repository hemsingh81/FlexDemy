import React from 'react';
import { Award } from 'lucide-react';

interface EducatorStudioHeaderProps {
  isOnline: boolean;
  onToggleOnlineStatus: () => void;
}

// Extracted from TutorEducatorHubView.tsx: the dark hero header with the title/description and
// the live availability on/off switch.
export const EducatorStudioHeader: React.FC<EducatorStudioHeaderProps> = ({
  isOnline,
  onToggleOnlineStatus,
}) => {
  return (
    <div className="rounded-3xl bg-[#143358] border border-white/10 p-6 sm:p-8 text-white shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="space-y-2 max-w-2xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-amber-200 border border-white/15">
          <Award className="w-4 h-4 text-[#EC7B38]" />
          <span>Educator & Instructor Studio</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
          Manage Teaching Availability, Slots & Analytics
        </h2>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          Control your live availability state, review earnings analytics, and publish multi-step courses using the Course Creation Wizard.
        </p>
      </div>

      {/* Live Availability Switch */}
      <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-3 w-full md:w-auto text-center md:text-right backdrop-blur-xs">
        <div className="flex items-center justify-between md:justify-end space-x-3">
          <span className="text-xs font-bold text-slate-200">Live Status:</span>
          <button
            onClick={onToggleOnlineStatus}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all shadow-md ${
              isOnline
                ? 'bg-[#179765] hover:bg-[#179765]/90 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-ping' : 'bg-white'}`} />
            <span>{isOnline ? '🟢 ONLINE (Accepting Calls)' : '🔴 OFFLINE'}</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-200">
          {isOnline
            ? 'Students see you active and ready for instant 1-on-1 tutoring.'
            : 'Status set to offline. Scheduled slots remain visible.'}
        </p>
      </div>
    </div>
  );
};
