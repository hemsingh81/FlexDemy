import React from 'react';
import { ArrowRight, Calendar, Clock, Edit, Plus, Radio, Users } from 'lucide-react';
import { PublicLiveClass, TutorCalendarSlot } from '../../types';

interface CalendarSlotsSectionProps {
  tutorSlots: TutorCalendarSlot[];
  publicClasses: PublicLiveClass[];
  onOpenNewPublicClassModal: () => void;
  onOpenAddSlotModal: () => void;
  onSlotClick: (slot: TutorCalendarSlot) => void;
  onEditPublicClass: (pClass: PublicLiveClass) => void;
}

// Extracted from TutorEducatorHubView.tsx: the calendar slot grid and the public live classes
// broadcast roster, plus the two "schedule" action buttons above them.
export const CalendarSlotsSection: React.FC<CalendarSlotsSectionProps> = ({
  tutorSlots,
  publicClasses,
  onOpenNewPublicClassModal,
  onOpenAddSlotModal,
  onSlotClick,
  onEditPublicClass,
}) => {
  return (
    <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold font-display text-[#142030] flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#143358]" />
            <span>Interactive Calendar Slots & Public Live Classes</span>
          </h3>
          <p className="text-xs text-[#5E6A79]">
            Click directly on any calendar time slot to schedule or modify a Public Live Class session instantly.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenNewPublicClassModal}
            className="px-4 py-2 bg-[#BA5012] hover:bg-[#BA5012]/90 text-white rounded-xl text-xs font-bold shadow-md shadow-[#BA5012]/20 flex items-center space-x-1.5 transition-all"
          >
            <Radio className="w-4 h-4" />
            <span>+ Schedule Public Live Class</span>
          </button>

          <button
            onClick={onOpenAddSlotModal}
            className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add 1-on-1 Slot</span>
          </button>
        </div>
      </div>

      {/* Calendar Slots Responsive Grid - Collapses gracefully into vertical cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutorSlots.map((slot) => {
          const isPublic = slot.sessionType === 'public_class';
          const matchedPublicClass = publicClasses.find(
            (c) =>
              c.scheduledDate === slot.date ||
              (slot.topic && c.title.toLowerCase().includes(slot.topic.toLowerCase())) ||
              isPublic
          );

          return (
            <div
              key={slot.id}
              onClick={() => onSlotClick(slot)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 space-y-3 relative group ${
                isPublic
                  ? 'bg-[#FAF7EC] border-[#BA5012]/40 hover:border-[#BA5012]'
                  : slot.isBooked
                  ? 'bg-[#143358]/5 border-[#143358]/30 hover:border-[#143358]'
                  : 'bg-white border-[#E1DED4] hover:border-[#143358]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#142030] flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-[#5E6A79]" />
                  <span>{slot.date}</span>
                </span>

                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                    isPublic
                      ? 'bg-[#BA5012] text-white'
                      : slot.isBooked
                      ? 'bg-[#143358] text-white'
                      : 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20'
                  }`}
                >
                  {isPublic ? (
                    <>
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>PUBLIC LIVE CLASS</span>
                    </>
                  ) : slot.isBooked ? (
                    <span>BOOKED 1-ON-1</span>
                  ) : (
                    <span>OPEN 1-ON-1 SLOT</span>
                  )}
                </span>
              </div>

              <div className="text-xs space-y-1.5">
                <p className="font-bold text-[#142030]">
                  {slot.startTime} - {slot.endTime} ({slot.durationMinutes} mins)
                </p>

                <p className="text-[#5E6A79] font-medium line-clamp-2">
                  Agenda: <span className="font-semibold text-[#142030]">{slot.topic || 'General Teaching Session'}</span>
                </p>

                {slot.isBooked && (
                  <p className="text-[#143358] font-bold flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Booked Student: {slot.bookedByStudentName || 'Sophia Chen'}</span>
                  </p>
                )}

                {isPublic && matchedPublicClass && (
                  <div className="p-2 rounded-xl bg-[#BA5012]/10 text-[#142030] text-[11px] font-semibold space-y-1 border border-[#BA5012]/20">
                    <div className="flex items-center justify-between">
                      <span>Price: ${matchedPublicClass.flatPrice.toFixed(2)}</span>
                      <span>{matchedPublicClass.subscribers.length} Registered</span>
                    </div>
                    <p className="text-[10px] text-[#BA5012] truncate">{matchedPublicClass.meetingUrl}</p>
                  </div>
                )}
              </div>

              {/* Hover CTA Button */}
              <div className="pt-2 border-t border-[#E1DED4] flex items-center justify-between text-[#143358] font-bold text-[11px]">
                <span className="flex items-center space-x-1">
                  <Edit className="w-3.5 h-3.5" />
                  <span>{isPublic ? 'Modify Public Live Class' : 'Click to Create / Edit Public Class'}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Public Live Classes Broadcast Roster - Grid responsive constraint */}
      <div className="pt-4 border-t border-[#E1DED4] space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold font-display text-[#142030] flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#BA5012]" />
            <span>Broadcasting Roster: Active Public Masterclasses ({publicClasses.length})</span>
          </h4>
          <span className="text-xs text-[#5E6A79]">
            Live broadcast sessions accessible to all enrolled students
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {publicClasses.map((pClass) => (
            <div
              key={pClass.id}
              className="p-4 rounded-2xl border border-[#E1DED4] bg-white space-y-3 shadow-2xs hover:border-[#BA5012] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FAF7EC] text-[#BA5012] border border-[#BA5012]/20 uppercase">
                    {pClass.subject} • {pClass.durationMinutes} MINS
                  </span>
                  <h5 className="font-bold font-display text-[#142030] text-sm mt-1">{pClass.title}</h5>
                </div>

                <button
                  onClick={() => onEditPublicClass(pClass)}
                  className="p-2 bg-[#FAF7EC] border border-[#E1DED4] hover:bg-[#143358] hover:text-white text-[#143358] rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs shrink-0 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Live Session</span>
                </button>
              </div>

              <p className="text-xs text-[#5E6A79] line-clamp-2">{pClass.description}</p>

              <div className="flex items-center justify-between text-xs text-[#142030] pt-2 border-t border-[#E1DED4] font-semibold">
                <span>📅 {pClass.scheduledDate} at {pClass.scheduledTime}</span>
                <span className="text-[#BA5012] font-bold">${pClass.flatPrice.toFixed(2)} (${pClass.pricePerMinute.toFixed(2)}/min)</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#5E6A79] pt-1">
                <div className="flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-[#143358]" />
                  <span className="font-bold text-[#142030]">{pClass.subscribers.length} Students Subscribed</span>
                </div>
                <span className="text-[#143358] font-semibold truncate max-w-[180px]">{pClass.meetingUrl}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
