import React, { useState, useEffect } from 'react';
import { Navbar } from './ui/Navbar';
import { AccessibilityModal } from './ui/AccessibilityModal';
import { LoginPage } from './features/Auth/LoginPage';
import { SignUpPage } from './features/Auth/SignUpPage';
import { ForgotPasswordPage } from './features/Auth/ForgotPasswordPage';
import { AppointmentToast } from './ui/AppointmentToast';
import { OfflineProgressToast } from './ui/OfflineProgressToast';
import { Footer } from './ui/Footer';
import { Dashboard } from './features/Dashboard/Dashboard';
import { CourseDiscover } from './features/CourseDiscover/CourseDiscover';
import { CourseOverviewScreen } from './features/CourseOverview/CourseOverviewScreen';
import { CoursePlayer } from './features/CoursePlayer/CoursePlayer';
import { AssignmentsView } from './features/Assignments/AssignmentsView';
import { GroupStudyView } from './features/GroupStudy/GroupStudyView';
import { ProgressAndCertificate } from './features/ProgressAndCertificate/ProgressAndCertificate';
import { TutorHubView } from './features/TutorHub/TutorHubView';
import { useTutorHub } from './features/TutorHub/useTutorHub';
import { DomainProvider, useDomain } from './context/DomainContext';
import { LanguageCode } from './lib/i18n';

export default function App() {
  return (
    <DomainProvider>
      <AppShell />
    </DomainProvider>
  );
}

function AppShell() {
  const { user, courses, isLoading, ensureEnrolled, updateUser, completeLesson } = useDomain();

  // Owns tutor/booking data once here (rather than inside TutorHubView) so
  // AppointmentToast can share the same fetched tutorSlots without a second,
  // un-synced copy of the same state.
  const tutorHub = useTutorHub();

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor' | 'course-overview'
  >('discover');

  const [activeCourseId, setActiveCourseId] = useState<string>('course_quantum_101');
  const [activeLessonId, setActiveLessonId] = useState<string | undefined>(undefined);

  // Auth gate -- mandatory sign-in before the app is reachable (mock-only, no backend yet)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');

  // Modals
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
    ensureEnrolled(courseId);
    setActiveTab('course-overview');
  };

  // Handle launching course player for reading
  const handleOpenCourse = (courseId: string, lessonId?: string) => {
    setActiveCourseId(courseId);
    setActiveLessonId(lessonId);
    ensureEnrolled(courseId, lessonId);
    setActiveTab('player');
  };

  const handleUpdateUser = updateUser;
  const handleCompleteLesson = completeLesson;

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses?.[0];

  if (isLoading || !user) return null;

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return (
        <SignUpPage
          onAuthenticated={() => setIsAuthenticated(true)}
          onGoToLogin={() => setAuthView('login')}
        />
      );
    }
    if (authView === 'forgot') {
      return <ForgotPasswordPage onGoToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginPage
        onAuthenticated={() => setIsAuthenticated(true)}
        onGoToSignUp={() => setAuthView('signup')}
        onGoToForgotPassword={() => setAuthView('forgot')}
      />
    );
  }

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
        onSignOut={() => setIsAuthenticated(false)}
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
            onOpenCourse={handleOpenCourseOverview}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'discover' && (
          <CourseDiscover
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

        {activeTab === 'tutor' && <TutorHubView tutorHub={tutorHub} />}

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

        {activeTab === 'assignments' && <AssignmentsView />}

        {activeTab === 'groups' && <GroupStudyView />}

        {activeTab === 'certificates' && <ProgressAndCertificate />}
      </main>

      <Footer language={user.language} />

      {/* Modals */}
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
        setPreferredVoice={(v) => updateUser({ preferredVoice: v })}
        ttsRate={user.ttsRate}
        setTtsRate={(r) => updateUser({ ttsRate: r })}
        ttsPitch={user.ttsPitch}
        setTtsPitch={(p) => updateUser({ ttsPitch: p })}
      />

      {/* Real-time Session Countdown Toast Notification */}
      <AppointmentToast
        bookedSlots={tutorHub.tutorSlots}
        onJoinSession={(slotId) => alert('Launching Virtual Meeting Room for Session...')}
      />

      {/* Offline Mode Local Persistence Toast Notification */}
      <OfflineProgressToast />

    </div>
  );
}
