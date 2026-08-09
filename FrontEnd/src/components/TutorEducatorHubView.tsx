import React, { useState } from 'react';
import {
  DollarSign,
  Clock,
  Users,
  Radio,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  Upload,
  FileText,
  BarChart2,
  TrendingUp,
  Sparkles,
  Award,
  Video,
  ArrowRight,
  BookOpen,
  X,
  Edit,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Course,
  UserProfile,
  TutorCalendarSlot,
  GroupClassRequest,
  PublicLiveClass,
  SubjectCategory,
  DifficultyLevel,
} from '../types';

interface TutorEducatorHubViewProps {
  user: UserProfile;
  courses: Course[];
  onAddCourse: (newCourse: Course) => void;
  tutorSlots: TutorCalendarSlot[];
  onUpdateSlot?: (updatedSlot: TutorCalendarSlot) => void;
  groupRequests: GroupClassRequest[];
  publicClasses: PublicLiveClass[];
  onAnnouncePublicClass: (newClass: PublicLiveClass) => void;
  isOnline: boolean;
  onToggleOnlineStatus: () => void;
}

export const TutorEducatorHubView: React.FC<TutorEducatorHubViewProps> = ({
  user,
  courses,
  onAddCourse,
  tutorSlots,
  onUpdateSlot,
  groupRequests,
  publicClasses,
  onAnnouncePublicClass,
  isOnline,
  onToggleOnlineStatus,
}) => {
  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard Form Values
  const [cTitle, setCTitle] = useState('');
  const [cShortDesc, setCShortDesc] = useState('');
  const [cFullDesc, setCFullDesc] = useState('');
  const [cSubject, setCSubject] = useState<SubjectCategory>('physics');
  const [cLevel, setCLevel] = useState<DifficultyLevel>('Intermediate');
  const [cGradeTag, setCGradeTag] = useState('Class 12th');
  const [cEstimatedHours, setCEstimatedHours] = useState(4);
  const [cTagsStr, setCTagsStr] = useState('Physics, Superposition, Quantum');
  const [cThumbnail, setCThumbnail] = useState(
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80'
  );

  // Wizard Lesson Builder
  const [lessons, setLessons] = useState<
    Array<{
      id: string;
      title: string;
      durationMinutes: number;
      level1Analogy: string;
      level2Principles: string;
    }>
  >([
    {
      id: 'l1',
      title: '1.1 Fundamental Principles & Intuitive Analogy',
      durationMinutes: 20,
      level1Analogy: 'Think of this system as a coin spinning in mid-air...',
      level2Principles: 'The core state vector is represented as |Ψ⟩ = α|0⟩ + β|1⟩...',
    },
  ]);

  // Analytics Data for Recharts
  const ANALYTICS_DATA = [
    { month: 'Mar', earnings: 1200, hours: 24, students: 45 },
    { month: 'Apr', earnings: 1850, hours: 32, students: 62 },
    { month: 'May', earnings: 2400, hours: 41, students: 88 },
    { month: 'Jun', earnings: 3100, hours: 50, students: 110 },
    { month: 'Jul', earnings: 3900, hours: 58, students: 142 },
    { month: 'Aug', earnings: 4650, hours: 64, students: 175 },
  ];

  // Slot Creation Modal
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [slotDate, setSlotDate] = useState('2026-08-09');
  const [slotStart, setSlotStart] = useState('02:00 PM');
  const [slotEnd, setSlotEnd] = useState('03:00 PM');
  const [slotTopic, setSlotTopic] = useState('Class 12th Quantum Vector Derivations');

  // Public Live Class & Slot Interactive Editor State
  const [isPublicClassModalOpen, setIsPublicClassModalOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<TutorCalendarSlot | null>(null);
  const [editingPublicClass, setEditingPublicClass] = useState<PublicLiveClass | null>(null);

  // Form fields for Public Live Class
  const [pcTitle, setPcTitle] = useState('');
  const [pcDescription, setPcDescription] = useState('');
  const [pcSubject, setPcSubject] = useState<SubjectCategory>('physics');
  const [pcDate, setPcDate] = useState('2026-08-10');
  const [pcTime, setPcTime] = useState('04:00 PM EST');
  const [pcDuration, setPcDuration] = useState(60);
  const [pcFlatPrice, setPcFlatPrice] = useState(25.00);
  const [pcPricePerMinute, setPcPricePerMinute] = useState(0.50);
  const [pcMeetingUrl, setPcMeetingUrl] = useState('https://meet.learnsphere.edu/public-quantum-101');
  const [pcSessionType, setPcSessionType] = useState<'public_class' | 'one_on_one'>('public_class');
  const [toastMessage, setToastMessage] = useState<string>('');

  const handleOpenPublicClassModalForSlot = (slot: TutorCalendarSlot) => {
    setSelectedSlotForEdit(slot);

    // Look up if a PublicLiveClass exists for this slot date or topic or if slot is public_class
    const matchedClass = publicClasses.find(
      (c) =>
        c.scheduledDate === slot.date ||
        (slot.topic && c.title.toLowerCase().includes(slot.topic.toLowerCase())) ||
        slot.sessionType === 'public_class'
    );

    if (matchedClass) {
      setEditingPublicClass(matchedClass);
      setPcTitle(matchedClass.title);
      setPcDescription(matchedClass.description);
      setPcSubject(matchedClass.subject || 'physics');
      setPcDate(matchedClass.scheduledDate || slot.date);
      setPcTime(matchedClass.scheduledTime || slot.startTime);
      setPcDuration(matchedClass.durationMinutes || slot.durationMinutes);
      setPcFlatPrice(matchedClass.flatPrice || 25.0);
      setPcPricePerMinute(matchedClass.pricePerMinute || slot.ratePerMinute || 0.50);
      setPcMeetingUrl(matchedClass.meetingUrl || 'https://meet.learnsphere.edu/public-room');
      setPcSessionType('public_class');
    } else {
      setEditingPublicClass(null);
      setPcTitle(slot.topic ? `Live Masterclass: ${slot.topic}` : 'Public Live Masterclass Session');
      setPcDescription('Interactive live broadcast covering key concept proofs, problem solving, and live student Q&A.');
      setPcSubject('physics');
      setPcDate(slot.date);
      setPcTime(slot.startTime);
      setPcDuration(slot.durationMinutes);
      setPcFlatPrice(25.0);
      setPcPricePerMinute(slot.ratePerMinute || 0.50);
      setPcMeetingUrl(`https://meet.learnsphere.edu/public-room-${slot.id}`);
      setPcSessionType(slot.sessionType === 'public_class' ? 'public_class' : 'public_class');
    }

    setIsPublicClassModalOpen(true);
  };

  const handleOpenPublicClassForClassItem = (pClass: PublicLiveClass) => {
    setEditingPublicClass(pClass);
    const matchedSlot = tutorSlots.find(
      (s) => s.date === pClass.scheduledDate || (s.topic && s.topic.toLowerCase().includes(pClass.title.toLowerCase()))
    );
    setSelectedSlotForEdit(matchedSlot || null);

    setPcTitle(pClass.title);
    setPcDescription(pClass.description);
    setPcSubject(pClass.subject || 'physics');
    setPcDate(pClass.scheduledDate);
    setPcTime(pClass.scheduledTime);
    setPcDuration(pClass.durationMinutes);
    setPcFlatPrice(pClass.flatPrice);
    setPcPricePerMinute(pClass.pricePerMinute);
    setPcMeetingUrl(pClass.meetingUrl || 'https://meet.learnsphere.edu/live-room');
    setPcSessionType('public_class');
    setIsPublicClassModalOpen(true);
  };

  const handleOpenNewPublicClassModal = () => {
    setSelectedSlotForEdit(null);
    setEditingPublicClass(null);
    setPcTitle('');
    setPcDescription('');
    setPcSubject('physics');
    setPcDate('2026-08-10');
    setPcTime('04:00 PM EST');
    setPcDuration(60);
    setPcFlatPrice(30.0);
    setPcPricePerMinute(0.50);
    setPcMeetingUrl(`https://meet.learnsphere.edu/masterclass-${Date.now().toString().slice(-4)}`);
    setPcSessionType('public_class');
    setIsPublicClassModalOpen(true);
  };

  const handleSavePublicClassModal = (e: React.FormEvent) => {
    e.preventDefault();

    const classId = editingPublicClass?.id || `pub_${Date.now()}`;
    const newOrUpdatedClass: PublicLiveClass = {
      id: classId,
      title: pcTitle || 'Public Live Masterclass',
      description: pcDescription || 'Live interactive broadcast for all enrolled students.',
      tutorName: user.name,
      tutorAvatar: user.avatar,
      tutorRole: 'Verified LearnSphere Educator',
      scheduledDate: pcDate,
      scheduledTime: pcTime,
      durationMinutes: Number(pcDuration) || 60,
      pricePerMinute: Number(pcPricePerMinute) || 0.50,
      flatPrice: Number(pcFlatPrice) || 25.00,
      subscribers: editingPublicClass?.subscribers || [],
      status: 'upcoming',
      meetingUrl: pcMeetingUrl,
      subject: pcSubject,
    };

    // Broadcast or update public class
    onAnnouncePublicClass(newOrUpdatedClass);

    // Sync with calendar slot
    if (selectedSlotForEdit) {
      const updatedSlot: TutorCalendarSlot = {
        ...selectedSlotForEdit,
        date: pcDate,
        startTime: pcTime,
        durationMinutes: Number(pcDuration) || selectedSlotForEdit.durationMinutes,
        sessionType: pcSessionType,
        topic: pcTitle || selectedSlotForEdit.topic,
        ratePerMinute: Number(pcPricePerMinute) || selectedSlotForEdit.ratePerMinute,
      };
      if (onUpdateSlot) {
        onUpdateSlot(updatedSlot);
      }
    } else if (onUpdateSlot) {
      const newSlot: TutorCalendarSlot = {
        id: `slot_${Date.now()}`,
        tutorId: user.id,
        tutorName: user.name,
        tutorAvatar: user.avatar,
        date: pcDate,
        startTime: pcTime,
        endTime: `${pcTime} (${pcDuration}m)`,
        durationMinutes: Number(pcDuration) || 60,
        isBooked: false,
        sessionType: pcSessionType,
        ratePerMinute: Number(pcPricePerMinute) || 0.50,
        topic: pcTitle,
      };
      onUpdateSlot(newSlot);
    }

    setToastMessage(`Public Live Class "${newOrUpdatedClass.title}" ${editingPublicClass ? 'updated' : 'scheduled & broadcasted'} successfully!`);
    setIsPublicClassModalOpen(false);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handlePublishCourse = () => {
    const tagsArray = cTagsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const newCourse: Course = {
      id: `course_custom_${Date.now()}`,
      title: cTitle || 'New Interactive Course',
      shortDescription: cShortDesc || 'Interactive course created by instructor.',
      fullDescription: cFullDesc || 'Detailed course curriculum with 5-level drilldowns.',
      subject: cSubject,
      level: cLevel,
      targetGradeTag: cGradeTag,
      tags: tagsArray,
      type: 'interactive',
      instructor: {
        name: user.name,
        role: 'Verified LearnSphere Educator',
        avatar: user.avatar,
      },
      enrolledCount: 1,
      rating: 5.0,
      estimatedHours: cEstimatedHours,
      thumbnail: cThumbnail,
      badgeIcon: 'Award',
      prerequisites: ['Basic Mathematics & Physics Concepts'],
      modules: [
        {
          id: 'mod_1',
          title: 'Module 1: Foundations',
          lessons: lessons.map((l) => ({
            id: l.id,
            title: l.title,
            durationMinutes: l.durationMinutes,
            sentences: [
              { id: 's1', text: l.level1Analogy },
              { id: 's2', text: l.level2Principles },
            ],
            drilldowns: {},
          })),
        },
      ],
    };

    onAddCourse(newCourse);
    setIsWizardOpen(false);
    alert('Course published successfully! It is now live in the course discovery library.');
  };

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto">
      
      {/* Educator Studio Header & Online/Offline Status Switcher */}
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

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1">
          <p className="text-xs text-[#5E6A79] font-medium">Total Teaching Revenue</p>
          <p className="text-2xl font-bold font-display text-[#EC7B38]">$4,650.00</p>
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

        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-1 flex flex-col justify-between">
          <p className="text-xs text-[#5E6A79] font-medium">Course Creation</p>
          <button
            onClick={() => {
              setWizardStep(1);
              setIsWizardOpen(true);
            }}
            className="w-full py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>New Course Wizard</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Recharts Analytics Engine */}
      <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-display text-[#142030] flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-[#143358]" />
              <span>Earnings & Teaching Analytics</span>
            </h3>
            <p className="text-xs text-[#5E6A79]">Monthly revenue growth and student engagement index.</p>
          </div>
          <span className="text-xs font-bold text-[#142030] bg-[#FAF7EC] border border-[#E1DED4] px-3 py-1 rounded-xl">
            2026 Analytics
          </span>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ANALYTICS_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1DED4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5E6A79' }} />
              <YAxis tick={{ fontSize: 12, fill: '#5E6A79' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#143358', borderRadius: '12px', color: '#fff', border: 'none' }}
              />
              <Legend />
              <Bar dataKey="earnings" name="Monthly Revenue ($)" fill="#143358" radius={[6, 6, 0, 0]} />
              <Bar dataKey="hours" name="Teaching Hours" fill="#EC7B38" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2: Calendar Slot Management & Public Live Classes */}
      <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-6">
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-[#179765]/10 border border-[#179765]/30 text-[#179765] text-xs font-bold flex items-center justify-between animate-fade-in">
            <span className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#179765]" />
              <span>{toastMessage}</span>
            </span>
            <button onClick={() => setToastMessage('')} className="text-[#179765] hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
              onClick={handleOpenNewPublicClassModal}
              className="px-4 py-2 bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white rounded-xl text-xs font-bold shadow-md shadow-[#EC7B38]/20 flex items-center space-x-1.5 transition-all"
            >
              <Radio className="w-4 h-4" />
              <span>+ Schedule Public Live Class</span>
            </button>

            <button
              onClick={() => setIsSlotModalOpen(true)}
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
                onClick={() => handleOpenPublicClassModalForSlot(slot)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 space-y-3 relative group ${
                  isPublic
                    ? 'bg-[#FAF7EC] border-[#EC7B38]/40 hover:border-[#EC7B38]'
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
                        ? 'bg-[#EC7B38] text-white'
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
                    <div className="p-2 rounded-xl bg-[#EC7B38]/10 text-[#142030] text-[11px] font-semibold space-y-1 border border-[#EC7B38]/20">
                      <div className="flex items-center justify-between">
                        <span>Price: ${matchedPublicClass.flatPrice.toFixed(2)}</span>
                        <span>{matchedPublicClass.subscribers.length} Registered</span>
                      </div>
                      <p className="text-[10px] text-[#EC7B38] truncate">{matchedPublicClass.meetingUrl}</p>
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
              <Radio className="w-4 h-4 text-[#EC7B38]" />
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
                className="p-4 rounded-2xl border border-[#E1DED4] bg-white space-y-3 shadow-2xs hover:border-[#EC7B38] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FAF7EC] text-[#EC7B38] border border-[#EC7B38]/20 uppercase">
                      {pClass.subject} • {pClass.durationMinutes} MINS
                    </span>
                    <h5 className="font-bold font-display text-[#142030] text-sm mt-1">{pClass.title}</h5>
                  </div>
                  
                  <button
                    onClick={() => handleOpenPublicClassForClassItem(pClass)}
                    className="p-2 bg-[#FAF7EC] border border-[#E1DED4] hover:bg-[#143358] hover:text-white text-[#143358] rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs shrink-0 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Live Session</span>
                  </button>
                </div>

                <p className="text-xs text-[#5E6A79] line-clamp-2">{pClass.description}</p>

                <div className="flex items-center justify-between text-xs text-[#142030] pt-2 border-t border-[#E1DED4] font-semibold">
                  <span>📅 {pClass.scheduledDate} at {pClass.scheduledTime}</span>
                  <span className="text-[#EC7B38] font-bold">${pClass.flatPrice.toFixed(2)} (${pClass.pricePerMinute.toFixed(2)}/min)</span>
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

      {/* Course Creation Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase">
                  Step {wizardStep} of 4
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Course Creation Wizard
                </h3>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
              <div className={`p-2 rounded-xl ${wizardStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                1. Info & Grade Tag
              </div>
              <div className={`p-2 rounded-xl ${wizardStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                2. Assets & Thumb
              </div>
              <div className={`p-2 rounded-xl ${wizardStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                3. Lesson Builder
              </div>
              <div className={`p-2 rounded-xl ${wizardStep >= 4 ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                4. Review & Publish
              </div>
            </div>

            {/* STEP 1: Basic Info */}
            {wizardStep === 1 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-800">Course Title:</label>
                  <input
                    type="text"
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="E.g., Class 12th Physics: Advanced Electromagnetic Waves"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800">Target Grade Tag:</label>
                    <select
                      value={cGradeTag}
                      onChange={(e) => setCGradeTag(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900"
                    >
                      <option value="Class 10th">Class 10th</option>
                      <option value="Class 12th">Class 12th</option>
                      <option value="Undergrad / College">Undergrad / College</option>
                      <option value="PhD Level">PhD Level</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800">Subject Category:</label>
                    <select
                      value={cSubject}
                      onChange={(e) => setCSubject(e.target.value as SubjectCategory)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900"
                    >
                      <option value="physics">Physics</option>
                      <option value="computer_science">Computer Science</option>
                      <option value="stem_math">Mathematics</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800">Short Summary:</label>
                  <textarea
                    value={cShortDesc}
                    onChange={(e) => setCShortDesc(e.target.value)}
                    placeholder="Brief description for discovery cards..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Next: Asset Upload →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Assets */}
            {wizardStep === 2 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-800">Thumbnail Image URL:</label>
                  <input
                    type="text"
                    value={cThumbnail}
                    onChange={(e) => setCThumbnail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900"
                  />
                </div>

                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-indigo-600" />
                  <p className="font-bold text-slate-800">Drag & Drop Syllabus PDF or Asset Files</p>
                  <p className="text-slate-500 text-[10px]">Supports .pdf, .docx, .py up to 50MB</p>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Next: Lesson Builder →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Lessons */}
            {wizardStep === 3 && (
              <div className="space-y-4 text-xs">
                <h4 className="font-bold text-slate-900">Module Lessons ({lessons.length})</h4>

                {lessons.map((les, idx) => (
                  <div key={les.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <p className="font-bold text-indigo-700">Lesson {idx + 1}</p>
                    <input
                      type="text"
                      value={les.title}
                      onChange={(e) => {
                        const updated = [...lessons];
                        updated[idx].title = e.target.value;
                        setLessons(updated);
                      }}
                      className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                    />
                  </div>
                ))}

                <button
                  onClick={() =>
                    setLessons([
                      ...lessons,
                      {
                        id: `l_${Date.now()}`,
                        title: `1.${lessons.length + 1} New Topic Concept`,
                        durationMinutes: 15,
                        level1Analogy: 'Analogy for level 1...',
                        level2Principles: 'Mathematical principles for level 2...',
                      },
                    ])
                  }
                  className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200"
                >
                  + Add Lesson
                </button>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Next: Review & Publish →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Review & Publish */}
            {wizardStep === 4 && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
                  <p className="font-bold text-indigo-900 text-sm">{cTitle || 'Untitled Course'}</p>
                  <p className="text-slate-700">Target Grade Tag: <span className="font-bold">{cGradeTag}</span></p>
                  <p className="text-slate-700">Subject: <span className="font-bold">{cSubject}</span></p>
                  <p className="text-slate-700">Lessons Count: <span className="font-bold">{lessons.length}</span></p>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePublishCourse}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold shadow-lg shadow-emerald-600/20"
                  >
                    🚀 Publish Course Now
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Add Teaching Calendar Slot</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Date:</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Start Time:</label>
                  <input
                    type="text"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    placeholder="02:00 PM"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">End Time:</label>
                  <input
                    type="text"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    placeholder="03:00 PM"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Topic / Agenda:</label>
                <input
                  type="text"
                  value={slotTopic}
                  onChange={(e) => setSlotTopic(e.target.value)}
                  placeholder="E.g., Class 12th Board Exam Physics Derivations"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                onClick={() => setIsSlotModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onUpdateSlot) {
                    onUpdateSlot({
                      id: `slot_${Date.now()}`,
                      tutorId: user.id,
                      tutorName: user.name,
                      tutorAvatar: user.avatar,
                      date: slotDate,
                      startTime: slotStart,
                      endTime: slotEnd,
                      durationMinutes: 60,
                      isBooked: false,
                      sessionType: 'one_on_one',
                      ratePerMinute: 1.50,
                      topic: slotTopic,
                    });
                  }
                  setToastMessage('New teaching calendar slot added!');
                  setIsSlotModalOpen(false);
                  setTimeout(() => setToastMessage(''), 4000);
                }}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Save Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Public Live Class & Calendar Slot Editor Modal */}
      {isPublicClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {editingPublicClass ? 'Modify Public Live Class Session' : 'Create & Schedule Public Live Class'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedSlotForEdit
                      ? `Linked to Calendar Slot: ${selectedSlotForEdit.date} (${selectedSlotForEdit.startTime})`
                      : 'Broadcasting live session to all students on LearnSphere'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPublicClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePublicClassModal} className="space-y-4 text-xs">
              {/* Session Type Toggle */}
              <div>
                <label className="font-bold text-slate-800">Session Mode:</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPcSessionType('public_class')}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all flex items-center space-x-2 ${
                      pcSessionType === 'public_class'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Radio className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Public Live Class</p>
                      <p className="text-[10px] font-normal opacity-90">Open broadcast for multiple students</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPcSessionType('one_on_one')}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all flex items-center space-x-2 ${
                      pcSessionType === 'one_on_one'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">1-on-1 Tutoring</p>
                      <p className="text-[10px] font-normal opacity-90">Private single student booking</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Class Title */}
              <div>
                <label className="font-bold text-slate-800">Live Masterclass Title:</label>
                <input
                  type="text"
                  required
                  value={pcTitle}
                  onChange={(e) => setPcTitle(e.target.value)}
                  placeholder="E.g., Class 12th Quantum Grover Algorithm & Qiskit Live Proof"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                />
              </div>

              {/* Subject & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800">Subject Category:</label>
                  <select
                    value={pcSubject}
                    onChange={(e) => setPcSubject(e.target.value as SubjectCategory)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  >
                    <option value="physics">Physics</option>
                    <option value="computer_science">Computer Science</option>
                    <option value="stem_math">Mathematics</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800">Duration (Minutes):</label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={pcDuration}
                    onChange={(e) => setPcDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800">Scheduled Date:</label>
                  <input
                    type="date"
                    required
                    value={pcDate}
                    onChange={(e) => setPcDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800">Start Time:</label>
                  <input
                    type="text"
                    required
                    value={pcTime}
                    onChange={(e) => setPcTime(e.target.value)}
                    placeholder="04:00 PM EST"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800">Flat Admission Price ($):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={pcFlatPrice}
                    onChange={(e) => setPcFlatPrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800">Price Per Minute ($):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={pcPricePerMinute}
                    onChange={(e) => setPcPricePerMinute(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Meeting Link */}
              <div>
                <label className="font-bold text-slate-800">Virtual Room / Live Meeting URL:</label>
                <input
                  type="text"
                  required
                  value={pcMeetingUrl}
                  onChange={(e) => setPcMeetingUrl(e.target.value)}
                  placeholder="https://meet.learnsphere.edu/public-room-101"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                />
              </div>

              {/* Description / Agenda */}
              <div>
                <label className="font-bold text-slate-800">Short Description & Learning Agenda:</label>
                <textarea
                  rows={3}
                  value={pcDescription}
                  onChange={(e) => setPcDescription(e.target.value)}
                  placeholder="Describe key derivations, problem sets, or coding walkthroughs covered..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs mt-1 text-slate-900 font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPublicClassModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-extrabold shadow-lg shadow-purple-600/30 flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{editingPublicClass ? 'Save Changes' : '🚀 Save & Broadcast Public Session'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
