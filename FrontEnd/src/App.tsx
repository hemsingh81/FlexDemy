import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { AccessibilityModal } from './components/AccessibilityModal';
import { Dashboard } from './components/Dashboard';
import { CourseDiscover } from './components/CourseDiscover';
import { CoursePlayer } from './components/CoursePlayer/CoursePlayer';
import { AssignmentsView } from './components/AssignmentsView';
import { GroupStudyView } from './components/GroupStudyView';
import { ProgressAndCertificate } from './components/ProgressAndCertificate';
import { TutorHubView } from './components/TutorHubView';
import { CourseOverviewScreen } from './components/CourseOverviewScreen';
import { AppointmentToast } from './components/AppointmentToast';
import { OfflineProgressToast } from './components/OfflineProgressToast';

import {
  INITIAL_USER,
  MOCK_COURSES,
  MOCK_STUDY_ROOMS,
  MOCK_LEADERBOARD,
  MOCK_TUTOR_SLOTS,
  MOCK_GROUP_REQUESTS,
  MOCK_PUBLIC_CLASSES,
} from './data/mockData';
import {
  UserProfile,
  Course,
  TopicAssignment,
  TutorCalendarSlot,
  GroupClassRequest,
  PublicLiveClass,
} from './types';
import { LanguageCode } from './lib/i18n';

export default function App() {
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  
  // Tutoring & Booking State
  const [tutorSlots, setTutorSlots] = useState<TutorCalendarSlot[]>(MOCK_TUTOR_SLOTS);
  const [groupRequests, setGroupRequests] = useState<GroupClassRequest[]>(MOCK_GROUP_REQUESTS);
  const [publicClasses, setPublicClasses] = useState<PublicLiveClass[]>(MOCK_PUBLIC_CLASSES);

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor' | 'course-overview'
  >('discover');

  const [activeCourseId, setActiveCourseId] = useState<string>('course_quantum_101');
  const [activeLessonId, setActiveLessonId] = useState<string | undefined>(undefined);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);

  // Theme & Accessibility Settings
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [autoSpeakFocus, setAutoSpeakFocus] = useState(false);

  // Enforce Light Theme for smooth consistent learning experience
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Handle opening course overview details screen
  const handleOpenCourseOverview = (courseId: string) => {
    setActiveCourseId(courseId);
    if (!user.progress[courseId]) {
      setUser((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          [courseId]: {
            courseId,
            completedLessonIds: [],
            lastLessonId: 'qc_l1',
            lastSentenceIndex: 0,
            assignmentScores: {},
            timeSpentSeconds: 0,
            enrolledDate: new Date().toISOString().split('T')[0],
          },
        },
      }));
    }
    setActiveTab('course-overview');
  };

  // Handle launching course player for reading
  const handleOpenCourse = (courseId: string, lessonId?: string) => {
    setActiveCourseId(courseId);
    setActiveLessonId(lessonId);
    
    // Ensure user has an enrollment record
    if (!user.progress[courseId]) {
      setUser((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          [courseId]: {
            courseId,
            completedLessonIds: [],
            lastLessonId: lessonId || 'qc_l1',
            lastSentenceIndex: 0,
            assignmentScores: {},
            timeSpentSeconds: 0,
            enrolledDate: new Date().toISOString().split('T')[0],
          },
        },
      }));
    }

    setActiveTab('player');
  };

  const handleUpdateUser = (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const handleAwardPoints = (points: number) => {
    setUser((prev) => ({ ...prev, totalPoints: prev.totalPoints + points }));
  };

  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev]);
  };

  const handleBookSlot = (slotId: string, notes?: string) => {
    setTutorSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              isBooked: true,
              bookedByStudentName: user.name,
              bookedByStudentId: user.id,
              topic: notes || slot.topic || '1-on-1 Tutoring Session',
            }
          : slot
      )
    );
  };

  const handleUpdateSlot = (updatedSlot: TutorCalendarSlot) => {
    setTutorSlots((prev) => {
      const exists = prev.some((s) => s.id === updatedSlot.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s));
      }
      return [updatedSlot, ...prev];
    });
  };

  const handleAddGroupRequest = (req: GroupClassRequest) => {
    setGroupRequests((prev) => [req, ...prev]);
  };

  const handleJoinGroupRequest = (requestId: string) => {
    setGroupRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? {
              ...req,
              studentPool: req.studentPool.some((s) => s.studentId === user.id)
                ? req.studentPool
                : [...req.studentPool, { studentId: user.id, studentName: user.name, avatar: user.avatar }],
            }
          : req
      )
    );
  };

  const handleSubscribePublicClass = (classId: string) => {
    setPublicClasses((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        const isSubbed = cls.subscribers.some((s) => s.studentId === user.id) || cls.isSubscribedByMe;
        const updatedSubs = isSubbed
          ? cls.subscribers.filter((s) => s.studentId !== user.id)
          : [...cls.subscribers, { studentId: user.id, studentName: user.name, avatar: user.avatar }];
        return {
          ...cls,
          subscribers: updatedSubs,
          isSubscribedByMe: !isSubbed,
        };
      })
    );
  };

  const handleAnnouncePublicClass = (newClass: PublicLiveClass) => {
    setPublicClasses((prev) => {
      const index = prev.findIndex((c) => c.id === newClass.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = newClass;
        return copy;
      }
      return [newClass, ...prev];
    });
  };

  const handleCompleteLesson = (courseId: string, lessonId: string) => {
    setUser((prev) => {
      const existingProg = prev.progress[courseId] || {
        courseId,
        completedLessonIds: [],
        lastLessonId: lessonId,
        lastSentenceIndex: 0,
        assignmentScores: {},
        timeSpentSeconds: 0,
        enrolledDate: new Date().toISOString().split('T')[0],
      };

      const isNewCompletion = !existingProg.completedLessonIds.includes(lessonId);
      const updatedCompleted = isNewCompletion
        ? [...existingProg.completedLessonIds, lessonId]
        : existingProg.completedLessonIds;

      return {
        ...prev,
        totalPoints: isNewCompletion ? prev.totalPoints + 100 : prev.totalPoints,
        progress: {
          ...prev.progress,
          [courseId]: {
            ...existingProg,
            completedLessonIds: updatedCompleted,
            lastLessonId: lessonId,
          },
        },
      };
    });
  };

  const allAssignments: TopicAssignment[] = courses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.flatMap((l) => (l.assignment ? [l.assignment] : [])))
  );

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses?.[0];

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 selection:bg-indigo-500/20 selection:text-indigo-900 transition-colors duration-200 ${
      highContrast ? 'contrast-125' : ''
    }`}>
      
      {/* Keyboard Navigable Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-[#EC7B38] focus:text-white focus:font-extrabold focus:text-xs focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white transition-all cursor-pointer"
      >
        Skip to Content
      </a>

      {/* Persistent Top Navigation Menu */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAccessibility={() => setIsAccessibilityOpen(true)}
        onLanguageChange={(lang: LanguageCode) => handleUpdateUser({ language: lang })}
        onToggleTheme={() => {}}
        isDarkMode={false}
        onSearchClick={() => setActiveTab('discover')}
      />

      {/* Main Container - 100% Width Layout */}
      <main id="main-content" tabIndex={-1} className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 pb-16 outline-none">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            courses={courses}
            onOpenCourse={handleOpenCourseOverview}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'discover' && (
          <CourseDiscover
            courses={courses}
            userLanguage={user.language}
            onOpenCourse={handleOpenCourseOverview}
          />
        )}

        {activeTab === 'course-overview' && activeCourse && (
          <CourseOverviewScreen
            course={activeCourse}
            progress={user.progress[activeCourse.id]}
            onStartLesson={(courseId, lessonId) => handleOpenCourse(courseId, lessonId)}
            onBack={() => setActiveTab('dashboard')}
            userLanguage={user.language}
          />
        )}

        {activeTab === 'tutor' && (
          <TutorHubView
            user={user}
            courses={courses}
            tutorSlots={tutorSlots}
            groupRequests={groupRequests}
            publicClasses={publicClasses}
            onAddCourse={handleAddCourse}
            onBookSlot={(slotId, notes) => handleBookSlot(slotId, notes)}
            onUpdateSlot={handleUpdateSlot}
            onRequestGroupClass={(topic, courseTitle) =>
              handleAddGroupRequest({
                id: `req_${Date.now()}`,
                topic,
                courseTitle,
                requestedByStudentId: user.id,
                requestedByStudentName: user.name,
                ratePerMinute: 0.90,
                maxParticipants: 5,
                status: 'pending',
                studentPool: [{ studentId: user.id, studentName: user.name, avatar: user.avatar }],
              })
            }
            onSubscribePublicClass={(classId) => handleSubscribePublicClass(classId)}
            onAnnouncePublicClass={handleAnnouncePublicClass}
          />
        )}

        {activeTab === 'player' && activeCourse && (
          <CoursePlayer
            course={activeCourse}
            initialLessonId={activeLessonId}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onOpenAssignment={(asgId) => setActiveTab('assignments')}
            fontSize={fontSize}
            highContrast={highContrast}
            onCompleteLesson={handleCompleteLesson}
          />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsView
            assignments={allAssignments}
            onAwardPoints={handleAwardPoints}
            userLanguage={user.language}
          />
        )}

        {activeTab === 'groups' && (
          <GroupStudyView
            rooms={MOCK_STUDY_ROOMS}
            userLanguage={user.language}
          />
        )}

        {activeTab === 'certificates' && (
          <ProgressAndCertificate
            user={user}
            courses={courses}
            leaderboard={MOCK_LEADERBOARD}
            userLanguage={user.language}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onUpdateUser={handleUpdateUser}
      />

      <AccessibilityModal
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        fontSize={fontSize}
        setFontSize={setFontSize}
        autoSpeakFocus={autoSpeakFocus}
        setAutoSpeakFocus={setAutoSpeakFocus}
        preferredVoice={user.preferredVoice}
        setPreferredVoice={(v) => setUser((prev) => ({ ...prev, preferredVoice: v }))}
        ttsRate={user.ttsRate}
        setTtsRate={(r) => setUser((prev) => ({ ...prev, ttsRate: r }))}
        ttsPitch={user.ttsPitch}
        setTtsPitch={(p) => setUser((prev) => ({ ...prev, ttsPitch: p }))}
      />

      {/* Real-time Session Countdown Toast Notification */}
      <AppointmentToast
        bookedSlots={tutorSlots}
        onJoinSession={(slotId) => alert('Launching Virtual Meeting Room for Session...')}
      />

      {/* Offline Mode Local Persistence Toast Notification */}
      <OfflineProgressToast />

    </div>
  );
}

