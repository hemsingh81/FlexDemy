import React, { useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  Users,
  Radio,
  Sparkles,
  ArrowRight,
  GraduationCap,
  MessageSquare,
  DollarSign,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import {
  TutorCalendarSlot,
  GroupClassRequest,
  PublicLiveClass,
  UserProfile,
} from '../types';

interface StudentTutorBookingViewProps {
  user: UserProfile;
  tutorSlots: TutorCalendarSlot[];
  onBookSlot: (slotId: string, notes?: string) => void;
  groupRequests: GroupClassRequest[];
  onRequestGroupClass: (topic: string, courseTitle: string) => void;
  publicClasses: PublicLiveClass[];
  onSubscribePublicClass: (classId: string) => void;
  tutorOnlineStatus?: boolean;
  displayMode?: 'auto' | 'table' | 'cards';
}

export const StudentTutorBookingView: React.FC<StudentTutorBookingViewProps> = ({
  user,
  tutorSlots,
  onBookSlot,
  groupRequests,
  onRequestGroupClass,
  publicClasses,
  onSubscribePublicClass,
  tutorOnlineStatus = true,
  displayMode = 'auto',
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<TutorCalendarSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string>('');

  // New Group Request Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [reqTopic, setReqTopic] = useState('');
  const [reqCourseTitle, setReqCourseTitle] = useState('');

  // Filter slots
  const filteredSlots = tutorSlots.filter((slot) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      slot.tutorName.toLowerCase().includes(q) ||
      slot.topic.toLowerCase().includes(q);
    const matchesSubject = selectedSubject === 'all' || true;
    return matchesSearch && matchesSubject;
  });

  // User's booked slots
  const myBookedSlots = tutorSlots.filter((s) => s.isBooked && (s.bookedByStudentId === user.id || s.studentName === user.name));

  const handleConfirmBooking = () => {
    if (!selectedSlotForBooking) return;
    onBookSlot(selectedSlotForBooking.id, bookingNotes || '1-on-1 Tutoring Session');
    setBookingSuccessMsg(`Successfully booked session with ${selectedSlotForBooking.tutorName}!`);
    setSelectedSlotForBooking(null);
    setBookingNotes('');
    setTimeout(() => setBookingSuccessMsg(''), 4000);
  };

  const handleCreateGroupReq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTopic || !reqCourseTitle) return;
    onRequestGroupClass(reqTopic, reqCourseTitle);
    setIsGroupModalOpen(false);
    setReqTopic('');
    setReqCourseTitle('');
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* Perspective Banner */}
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

      {bookingSuccessMsg && (
        <div className="p-4 rounded-2xl bg-[#179765]/10 border border-[#179765]/30 text-[#179765] text-sm font-bold flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#179765]" />
          <span>{bookingSuccessMsg}</span>
        </div>
      )}

      {/* SECTION 1: My Booked Appointments */}
      {myBookedSlots.length > 0 && (
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
                        onClick={() => alert(`Launching virtual meeting room with ${slot.tutorName}...`)}
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
                  onClick={() => alert(`Launching virtual meeting room with ${slot.tutorName}...`)}
                  className="w-full py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Meeting</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Available Tutor Calendar Slots */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tutors or topics..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E1DED4] rounded-xl text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#EC7B38] shadow-2xs"
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
                              onClick={() => setSelectedSlotForBooking(slot)}
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
                          onClick={() => setSelectedSlotForBooking(slot)}
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

      {/* SECTION 3: Group Class Requests & Public Masterclasses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
        
        {/* Group Class Pools */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Student Group Class Pools</span>
            </h3>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-all"
            >
              + Request Group Pool
            </button>
          </div>

          <div className="space-y-3">
            {groupRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">
                      {req.courseTitle}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      ${req.ratePerMinute.toFixed(2)}/min per student
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{req.topic}</h4>
                  <p className="text-xs text-slate-500">Requested by: {req.requestedByStudentName}</p>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-600 font-medium">
                    {req.studentPool.length} / {req.maxParticipants} Students Joined
                  </span>
                  <button
                    onClick={() => alert(`Joined group pool for ${req.topic}!`)}
                    className="px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Join Pool
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Public Masterclasses */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-indigo-600" />
            <span>Public Live Masterclasses</span>
          </h3>

          <div className="space-y-3">
            {publicClasses.map((cls) => (
              <div
                key={cls.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <img
                    src={cls.tutorAvatar}
                    alt={cls.tutorName}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{cls.title}</h4>
                    <p className="text-xs text-slate-500">
                      {cls.tutorName} · {cls.scheduledDate} ({cls.scheduledTime})
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{cls.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900">
                    ${cls.flatPrice.toFixed(2)} flat rate
                  </span>
                  <button
                    onClick={() => onSubscribePublicClass(cls.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      cls.isSubscribedByMe
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-[#143358] hover:bg-[#143358]/90 text-white shadow-xs'
                    }`}
                  >
                    {cls.isSubscribedByMe ? '✓ Registered' : 'Register Seat'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Booking Modal */}
      {selectedSlotForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-scale-up">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase border border-indigo-200">
                Confirm Tutoring Booking
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Book Slot with {selectedSlotForBooking.tutorName}
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-bold text-slate-900">{selectedSlotForBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span className="font-bold text-slate-900">{selectedSlotForBooking.startTime} - {selectedSlotForBooking.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-900">{selectedSlotForBooking.durationMinutes} minutes</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-sm">
                <span>Total Cost:</span>
                <span className="text-indigo-600">${(selectedSlotForBooking.ratePerMinute * selectedSlotForBooking.durationMinutes).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Topic / Notes for Tutor:</label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="E.g., I'm preparing for Class 12th board physics exam and need help deriving Bloch sphere state vectors..."
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedSlotForBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                className="px-5 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateGroupReq} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Request New Student Group Pool</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Course / Subject Title:</label>
                <input
                  type="text"
                  required
                  value={reqCourseTitle}
                  onChange={(e) => setReqCourseTitle(e.target.value)}
                  placeholder="E.g., Class 12th Physics - Electricity & Magnetism"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Specific Topic or Problem Set:</label>
                <input
                  type="text"
                  required
                  value={reqTopic}
                  onChange={(e) => setReqTopic(e.target.value)}
                  placeholder="E.g., Gauss Law Vector Proofs & Capacitor Circuits"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Publish Group Pool
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
