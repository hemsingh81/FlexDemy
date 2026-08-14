import React from 'react';
import { GraduationCap } from 'lucide-react';

interface BookingPerspectiveBannerProps {
  tutorOnlineStatus: boolean;
}

// Extracted from StudentTutorBookingView.tsx: the top hero banner with the featured tutor's
// online/offline status.
export const BookingPerspectiveBanner: React.FC<BookingPerspectiveBannerProps> = ({ tutorOnlineStatus }) => {
  return (
    <div className="rounded-3xl bg-[#143358] p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/10">
      <div className="space-y-2 max-w-2xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-amber-200 border border-white/15">
          <GraduationCap className="w-4 h-4 text-[#EC7B38]" />
          <span>Student Session Booking Portal</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white">
          Book 1-on-1 Tutors & Peer Group Sessions
        </h2>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          Connect with verified professors and AI subject mentors. Choose a slot, inspect topic agendas, or join student group pools to split tuition costs.
        </p>
      </div>

      <div className="bg-white/10 p-4 rounded-2xl border border-white/15 text-right space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">Featured Tutor Status</p>
        <div className="flex items-center space-x-2 justify-end">
          <span className={`w-3 h-3 rounded-full ${tutorOnlineStatus ? 'bg-[#179765] animate-ping' : 'bg-slate-400'}`} />
          <span className="text-sm font-bold text-white">
            {tutorOnlineStatus ? 'Dr. Elena Rostova is ONLINE' : 'Dr. Elena Rostova is Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};
