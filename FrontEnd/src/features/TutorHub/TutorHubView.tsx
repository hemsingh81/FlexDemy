import React, { useState } from 'react';
import { StudentTutorBookingView } from './StudentTutorBookingView';
import { TutorEducatorHubView } from './TutorEducatorHubView';
import { GraduationCap, Award, LayoutGrid, Table } from 'lucide-react';
import { useTutorHub } from './useTutorHub';

// Accepts the useTutorHub() result as a prop (rather than calling the hook itself)
// so App.tsx can call it once and share tutorSlots with AppointmentToast without
// two independent, un-synced copies of the same fetched state.
interface TutorHubViewProps {
  tutorHub: ReturnType<typeof useTutorHub>;
}

export const TutorHubView: React.FC<TutorHubViewProps> = ({ tutorHub }) => {
  const {
    user,
    courses,
    tutorSlots,
    groupRequests,
    publicClasses,
    isLoading,
    addCourse,
    bookSlot,
    updateSlot,
    requestGroupClass,
    subscribePublicClass,
    announcePublicClass,
  } = tutorHub;

  // Perspective mode: 'student' vs 'educator'
  const [perspective, setPerspective] = useState<'student' | 'educator'>('student');
  const [isTutorOnline, setIsTutorOnline] = useState(true);
  // Responsive layout mode: 'auto' (Responsive Table on Desktop, Vertical Cards on Mobile), 'table', 'cards'
  const [displayMode, setDisplayMode] = useState<'auto' | 'table' | 'cards'>('auto');

  if (isLoading || !user) return null;

  return (
    <div className="space-y-8 pb-12 w-full">

      {/* Top Header Controls Bar: Perspective & Layout Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs">

        {/* Perspective Switcher */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setPerspective('student')}
            className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              perspective === 'student'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student View</span>
          </button>

          <button
            onClick={() => setPerspective('educator')}
            className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              perspective === 'educator'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Educator Studio</span>
          </button>
        </div>

        {/* Layout Display Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto justify-center">
          <span className="text-[10px] text-slate-500 uppercase px-2 font-bold hidden md:inline">Layout:</span>
          <button
            onClick={() => setDisplayMode('auto')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              displayMode === 'auto'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Auto-Responsive: Tabular on desktop, collapses to vertical cards on smaller viewports"
          >
            <Table className="w-3.5 h-3.5 sm:hidden" />
            <span>Responsive Auto</span>
          </button>

          <button
            onClick={() => setDisplayMode('table')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              displayMode === 'table'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Force Full Tabular Data Table format"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Data Table</span>
          </button>

          <button
            onClick={() => setDisplayMode('cards')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              displayMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Force Vertical Cards Grid format"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid Cards</span>
          </button>
        </div>

      </div>

      {/* Render Perspective Content */}
      {perspective === 'student' ? (
        <StudentTutorBookingView
          user={user}
          tutorSlots={tutorSlots}
          onBookSlot={bookSlot}
          groupRequests={groupRequests}
          onRequestGroupClass={requestGroupClass}
          publicClasses={publicClasses}
          onSubscribePublicClass={subscribePublicClass}
          tutorOnlineStatus={isTutorOnline}
          displayMode={displayMode}
        />
      ) : (
        <TutorEducatorHubView
          user={user}
          courses={courses}
          onAddCourse={addCourse}
          tutorSlots={tutorSlots}
          onUpdateSlot={updateSlot}
          groupRequests={groupRequests}
          publicClasses={publicClasses}
          onAnnouncePublicClass={announcePublicClass}
          isOnline={isTutorOnline}
          onToggleOnlineStatus={() => setIsTutorOnline(!isTutorOnline)}
          displayMode={displayMode}
        />
      )}

    </div>
  );
};
