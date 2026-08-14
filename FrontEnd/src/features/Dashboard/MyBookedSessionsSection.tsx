import React from 'react';
import { Calendar, Clock, Video } from 'lucide-react';
import { TutorCalendarSlot } from '../../types';
import { useToast } from '../../context/ToastContext';

interface MyBookedSessionsSectionProps {
  myBookedSlots: TutorCalendarSlot[];
  displayMode: 'auto' | 'table' | 'cards';
}

// Extracted from StudentTutorBookingView.tsx: "My Booked Tutoring Sessions" -- a responsive
// table (desktop/table mode) and card grid (mobile/cards mode) over the student's own confirmed
// 1-on-1 slots.
export const MyBookedSessionsSection: React.FC<MyBookedSessionsSectionProps> = ({ myBookedSlots, displayMode }) => {
  const { showToast } = useToast();

  if (myBookedSlots.length === 0) return null;

  const handleJoinMeeting = (tutorName: string) => {
    showToast({ message: `Launching virtual meeting room with ${tutorName}...`, variant: 'info' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#142030] flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-[#143358]" />
          <span>My Booked Tutoring Sessions ({myBookedSlots.length})</span>
        </h3>
        <span className="text-xs text-[#5E6A79] font-medium hidden sm:inline">
          Confirmed 1-on-1 Appointments Roster
        </span>
      </div>

      {/* Tabular Data Table (Desktop / Table Mode) */}
      <div className={`overflow-x-auto rounded-2xl border border-[#E1DED4] bg-white shadow-2xs ${
        displayMode === 'cards' ? 'hidden' : displayMode === 'table' ? 'block' : 'hidden md:block'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF7EC] border-b border-[#E1DED4] text-[#5E6A79] font-bold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Tutor Instructor</th>
              <th className="py-3 px-4">Agenda & Topic</th>
              <th className="py-3 px-4">Schedule</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1DED4]">
            {myBookedSlots.map((slot) => (
              <tr key={slot.id} className="hover:bg-[#FAF7EC] transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center space-x-3">
                    <img
                      src={slot.tutorAvatar}
                      alt={slot.tutorName}
                      className="w-9 h-9 rounded-xl object-cover border border-[#E1DED4]"
                    />
                    <div>
                      <p className="font-bold text-[#142030] text-xs">{slot.tutorName}</p>
                      <p className="text-[10px] text-[#5E6A79]">1-on-1 Mentor</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <p className="font-semibold text-[#142030] line-clamp-1">{slot.topic}</p>
                  {slot.notes && <p className="text-[11px] text-[#5E6A79] italic line-clamp-1">"{slot.notes}"</p>}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#FAF7EC] text-[#142030] font-semibold text-xs border border-[#E1DED4]">
                    <Calendar className="w-3.5 h-3.5 text-[#143358]" />
                    <span>{slot.date} · {slot.startTime} - {slot.endTime}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-full bg-[#179765]/10 text-[#179765] text-[10px] font-extrabold uppercase border border-[#179765]/30">
                    Confirmed Session
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleJoinMeeting(slot.tutorName)}
                    className="px-3.5 py-1.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-2xs inline-flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Meeting</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vertical Cards Stack (Mobile / Cards Mode) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
        displayMode === 'table' ? 'hidden' : displayMode === 'cards' ? 'grid' : 'grid md:hidden'
      }`}>
        {myBookedSlots.map((slot) => (
          <div
            key={slot.id}
            className="p-5 rounded-2xl bg-white border-2 border-[#143358] shadow-md flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#FAF7EC] text-[#143358] text-[10px] font-extrabold uppercase border border-[#E1DED4]">
                  Confirmed 1-on-1
                </span>
                <span className="text-xs text-[#5E6A79] font-medium">
                  {slot.date}
                </span>
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <img
                  src={slot.tutorAvatar}
                  alt={slot.tutorName}
                  className="w-10 h-10 rounded-xl object-cover border border-[#E1DED4]"
                />
                <div>
                  <h4 className="text-sm font-bold text-[#142030]">{slot.tutorName}</h4>
                  <p className="text-xs text-[#143358] font-medium line-clamp-1">{slot.topic}</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs text-[#142030] flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-[#143358] shrink-0" />
                <span>{slot.startTime} - {slot.endTime} ({slot.durationMinutes} mins)</span>
              </div>

              {slot.notes && (
                <p className="text-xs text-[#5E6A79] italic">Notes: "{slot.notes}"</p>
              )}
            </div>

            <button
              onClick={() => handleJoinMeeting(slot.tutorName)}
              className="w-full py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Join Meeting</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
