import React from 'react';
import { ArrowRight, Calendar, Clock, Search } from 'lucide-react';
import { TutorCalendarSlot } from '../../types';

interface AvailableSlotsSectionProps {
  filteredSlots: TutorCalendarSlot[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  tutorOnlineStatus: boolean;
  displayMode: 'auto' | 'table' | 'cards';
  onSelectSlotForBooking: (slot: TutorCalendarSlot) => void;
}

// Extracted from StudentTutorBookingView.tsx: the "Available 1-on-1 Tutoring Calendar Slots"
// section -- the tutor/topic search box plus a responsive table (desktop/table mode) and card
// grid (mobile/cards mode) of bookable slots.
export const AvailableSlotsSection: React.FC<AvailableSlotsSectionProps> = ({
  filteredSlots,
  searchQuery,
  onSearchQueryChange,
  tutorOnlineStatus,
  displayMode,
  onSelectSlotForBooking,
}) => {
  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-[#142030] flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#143358]" />
            <span>Available 1-on-1 Tutoring Calendar Slots</span>
          </h3>
          <p className="text-xs text-[#5E6A79] mt-0.5">
            Select a slot to instantly lock in a private session with an expert tutor.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#5E6A79]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search tutors or topics..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E1DED4] rounded-xl text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012] shadow-2xs"
          />
        </div>
      </div>

      {filteredSlots.length === 0 ? (
        <div className="p-8 text-center bg-white border border-[#E1DED4] rounded-2xl text-[#5E6A79] text-xs">
          No calendar slots found matching "{searchQuery}".
        </div>
      ) : (
        <>
          {/* Tabular Data Table View (Desktop / Table Mode) */}
          <div className={`overflow-x-auto rounded-2xl border border-[#E1DED4] bg-white shadow-2xs ${
            displayMode === 'cards' ? 'hidden' : displayMode === 'table' ? 'block' : 'hidden md:block'
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7EC] border-b border-[#E1DED4] text-[#5E6A79] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Tutor</th>
                  <th className="py-3 px-4">Agenda / Topic</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Tuition Rate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1DED4]">
                {filteredSlots.map((slot) => {
                  const isBooked = slot.isBooked;
                  return (
                    <tr key={slot.id} className={`transition-colors ${isBooked ? 'bg-[#FAF7EC]/60 opacity-70' : 'hover:bg-[#FAF7EC]'}`}>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <img
                              src={slot.tutorAvatar}
                              alt={slot.tutorName}
                              className="w-9 h-9 rounded-xl object-cover border border-[#E1DED4]"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                tutorOnlineStatus ? 'bg-[#179765]' : 'bg-slate-400'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-bold text-[#142030] text-xs">{slot.tutorName}</p>
                            <p className="text-[10px] text-[#179765] font-semibold">Verified Instructor</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#142030] line-clamp-1">{slot.topic}</p>
                        <p className="text-[10px] text-[#5E6A79]">1-on-1 Interactive Tutoring</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#142030] text-xs flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-[#143358] inline" />
                            <span>{slot.date}</span>
                          </p>
                          <p className="text-[11px] text-[#5E6A79] font-medium">
                            {slot.startTime} - {slot.endTime} ({slot.durationMinutes}m)
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-extrabold text-[#142030] text-xs bg-[#FAF7EC] px-2.5 py-1 rounded-lg border border-[#E1DED4]">
                          ${slot.ratePerMinute.toFixed(2)}/min (${(slot.ratePerMinute * slot.durationMinutes).toFixed(0)} total)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                          isBooked
                            ? 'bg-slate-200 text-slate-600 border-slate-300'
                            : 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                        }`}>
                          {isBooked ? 'BOOKED' : 'AVAILABLE'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isBooked ? (
                          <span className="text-xs text-slate-400 italic">Booked</span>
                        ) : (
                          <button
                            onClick={() => onSelectSlotForBooking(slot)}
                            className="px-3.5 py-1.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <span>Book Slot</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vertical Cards Grid View (Mobile / Cards Mode) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${
            displayMode === 'table' ? 'hidden' : displayMode === 'cards' ? 'grid' : 'grid md:hidden'
          }`}>
            {filteredSlots.map((slot) => {
              const isBooked = slot.isBooked;

              return (
                <div
                  key={slot.id}
                  className={`p-5 rounded-2xl bg-white border transition-all space-y-4 flex flex-col justify-between group relative ${
                    isBooked
                      ? 'border-[#E1DED4] opacity-60 bg-[#FAF7EC]'
                      : 'border-[#E1DED4] hover:border-[#143358] hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Tutor Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={slot.tutorAvatar}
                            alt={slot.tutorName}
                            className="w-12 h-12 rounded-xl object-cover border border-[#E1DED4]"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                              tutorOnlineStatus ? 'bg-[#179765]' : 'bg-slate-400'
                            }`}
                            title={tutorOnlineStatus ? 'Tutor Online' : 'Tutor Offline'}
                          />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#142030]">{slot.tutorName}</h4>
                          <span className="text-[10px] font-bold text-[#179765] bg-[#179765]/10 px-2 py-0.5 rounded-full border border-[#179765]/20">
                            ${slot.ratePerMinute.toFixed(2)}/min (${(slot.ratePerMinute * slot.durationMinutes).toFixed(0)} total)
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                          isBooked
                            ? 'bg-slate-200 text-slate-600 border-slate-300'
                            : 'bg-[#179765]/10 text-[#179765] border-[#179765]/30'
                        }`}
                      >
                        {isBooked ? 'BOOKED' : 'AVAILABLE'}
                      </span>
                    </div>

                    {/* Slot Time & Date */}
                    <div className="p-3 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#142030]">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-[#143358]" />
                          <span>{slot.date}</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[#143358]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{slot.startTime} - {slot.endTime} ({slot.durationMinutes}m)</span>
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#142030] line-clamp-1 pt-1">
                        Agenda: {slot.topic}
                      </p>
                    </div>
                  </div>

                  {/* Booking Trigger */}
                  <div>
                    {isBooked ? (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
                      >
                        Slot Booked by {slot.bookedByStudentName || 'Student'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectSlotForBooking(slot)}
                        className="w-full py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md shadow-[#143358]/20 transition-all flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <span>Quick Book Slot</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
};
