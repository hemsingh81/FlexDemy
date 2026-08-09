import React, { useState, useEffect } from 'react';
import { Spinner } from './ui/Spinner';
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
import { ProfileSetupPage } from './features/ProfileSetup/ProfileSetupPage';
import { PendingApprovalPage } from './features/ProfileSetup/PendingApprovalPage';
import { TutorRejectedPage } from './features/ProfileSetup/TutorRejectedPage';
import { AdminPanel } from './features/Admin/AdminPanel';
import { PageTransition } from './ui/PageTransition';
import { AdminSubTab, useAdminPanel } from './features/Admin/useAdminPanel';
import { DomainProvider, useDomain } from './context/DomainContext';
import { ToastProvider, useToast } from './context/ToastContext';
import * as authService from './services/authService';
import { authUserToProfileUpdates } from './features/Auth/useAuth';

// Backstop shown while DomainContext.rolePermissions hasn't loaded yet (before login, and
// briefly right after -- refreshRolePermissions() is fire-and-forget from updateUser, not
// awaited before the auth gate flips). Reproduces pre-Phase-5 behavior exactly: every
// existing tab visible, admin hidden until the real map says otherwise.
// Hard cap on how long the session-restore check (GET /api/v1/auth/me) is allowed to hang
// before giving up and falling back to Login -- a slow/dropped connection should never leave
// the user stuck on the loading screen with no way forward.
const SESSION_CHECK_TIMEOUT_MS = 15000;

const DEFAULT_VISIBLE_TABS: Record<string, boolean> = {
  dashboard: true,
  discover: true,
  tutor: true,
  groups: true,
  assignments: true,
  certificates: true,
  admin: false,
};

export default function App() {
  return (
    <DomainProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </DomainProvider>
  );
}

function AppShell() {
  const { user, courses, isLoading, ensureEnrolled, updateUser, completeLesson, rolePermissions } = useDomain();
  const { showToast } = useToast();

  // Owns tutor/booking data once here (rather than inside TutorHubView) so
  // AppointmentToast can share the same fetched tutorSlots without a second,
  // un-synced copy of the same state.
  const tutorHub = useTutorHub();

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'discover'
    | 'player'
    | 'groups'
    | 'assignments'
    | 'certificates'
    | 'tutor'
    | 'course-overview'
    | 'admin'
  >('discover');

  // Nav-tab visibility (plan §3/§5) -- keyed by DomainContext.rolePermissions, which is
  // fetched for the caller's current role and re-fetched on every role change (see
  // DomainContext.updateUser). Falls back to today's-behavior defaults while that hasn't
  // loaded yet (see DEFAULT_VISIBLE_TABS above).
  const visibleTabs = rolePermissions ?? DEFAULT_VISIBLE_TABS;

  // Admin sub-tab selection, lifted here (rather than owned inside AdminPanel/useAdminPanel)
  // so Navbar's Admin dropdown and AdminPanel's own in-page dropdown share one source of truth
  // instead of drifting apart -- see useAdminPanel.ts's "controlled" mode. availableAdminSubTabs
  // is the same role-filtered list useAdminPanel always computed; Navbar's dropdown reuses it
  // directly rather than re-deriving it from the role.
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<AdminSubTab>('masterdata');
  const { availableSubTabs: availableAdminSubTabs } = useAdminPanel({
    activeSubTab: activeAdminSubTab,
    setActiveSubTab: setActiveAdminSubTab,
  });
  const handleSelectAdminSubTab = (tab: AdminSubTab) => {
    setActiveAdminSubTab(tab);
    setActiveTab('admin');
  };

  const [activeCourseId, setActiveCourseId] = useState<string>('course_quantum_101');
  const [activeLessonId, setActiveLessonId] = useState<string | undefined>(undefined);

  // Auth gate -- mandatory sign-in before the app is reachable.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');

  // Session-restore bootstrap: authService persists the JWT to sessionStorage (see
  // authService.ts), so a same-tab refresh shouldn't drop the user back to Login. getToken()
  // already reflects any persisted token synchronously at this point -- authService's module-
  // level initializeFromStorage() runs at import time, before this component ever mounts --
  // so this lazy initializer decides up front whether there's anything to check at all. No
  // token -> skip straight to 'done' (today's behavior: Login renders immediately, no spinner
  // flash). A token -> stay 'pending' until the effect below validates it against the backend.
  const [sessionCheck, setSessionCheck] = useState<'pending' | 'checking' | 'done'>(() =>
    authService.getToken() ? 'pending' : 'done'
  );
  // Holds a successfully-restored session until DomainContext's `user` exists to apply it to
  // (updateUser is a no-op on a null user -- see below). Kept separate from `sessionCheck` so
  // the /auth/me call itself doesn't have to wait for that to be true first.
  const [pendingAuthUser, setPendingAuthUser] = useState<Awaited<ReturnType<typeof authService.getCurrentUser>>>(null);

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

  // Validates a persisted token (GET /api/v1/auth/me). Fires immediately on mount, in parallel
  // with DomainContext's own initial load -- it used to wait for that to finish first (gated on
  // `!isLoading && user`), which serialized two network round-trips back to back on every single
  // refresh (DomainContext's own rolePermissions fetch, then this) instead of running them
  // concurrently, roughly doubling how long a refresh took to become usable. A hard timeout
  // guards against a hung request leaving the user stuck on the loading screen forever ("not
  // able to refresh").
  useEffect(() => {
    // Guards against StrictMode's dev-mode double-invoke re-running this, not against a real
    // re-run -- this effect is intentionally mount-only (see the empty dep array below): it
    // must NOT depend on `sessionCheck`, since it's the one setting it, and including it here
    // previously caused React to run this effect's own cleanup (poisoning `settled`) the instant
    // `setSessionCheck('checking')` landed -- before the async work below ever got to finish,
    // permanently stranding the UI on the "Checking your session..." screen.
    if (sessionCheck !== 'pending') return;

    let settled = false;
    setSessionCheck('checking');

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      authService.logout();
      setSessionCheck('done');
    }, SESSION_CHECK_TIMEOUT_MS);

    authService
      .getCurrentUser()
      .then((authUser) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (authUser) {
          // Applied once `user` exists (see the effect below) -- same shape a fresh
          // login/register takes (useAuth.ts), reused rather than duplicated.
          setPendingAuthUser(authUser);
        } else {
          // 401 -- expired/invalid token. Not a session, clear it and fall through to Login.
          authService.logout();
        }
        setSessionCheck('done');
      })
      .catch(() => {
        // Network/server error checking the session -- don't strand the user on a token that
        // can't be validated right now; clear it and let them sign in again.
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        authService.logout();
        setSessionCheck('done');
      });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only, see the
    // comment above; `sessionCheck` is read once via the guard, never a re-run trigger.
  }, []);

  // Applies a restored session to DomainContext once `user` exists to apply it to (updateUser is
  // a no-op on a null user) -- decoupled from the effect above so that one doesn't have to wait
  // for DomainContext's load to finish before it can even start.
  useEffect(() => {
    if (!pendingAuthUser || !user) return;
    updateUser(authUserToProfileUpdates(pendingAuthUser));
    setIsAuthenticated(true);
    setPendingAuthUser(null);
  }, [pendingAuthUser, user, updateUser]);

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

  const handleCompleteLesson = completeLesson;

  // Shared by Navbar's onSignOut and the profile-completion funnel pages below -- clears the
  // persisted token (authService.logout()) as well as the in-memory isAuthenticated flag, so a
  // sign-out actually ends the session instead of leaving a token in sessionStorage that would
  // just re-authenticate on the next refresh.
  const handleSignOut = () => {
    authService.logout();
    setIsAuthenticated(false);
    showToast({ message: 'Signed out.', variant: 'info' });
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses?.[0];

  // Loading your workspace (courses/profile) and checking a persisted session are two
  // independent things happening in parallel (see the effects above) -- either one still
  // outstanding means the app isn't ready to render yet. Always show a real spinner *and*
  // visible text here (Spinner's `showLabel`), never a bare icon or a blank page -- a silent
  // wait reads as the page being stuck, not loading.
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="xl" className="text-[#143358]" label="Loading your workspace..." showLabel />
      </div>
    );
  }

  if (sessionCheck !== 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="xl" className="text-[#143358]" label="Checking your session..." showLabel />
      </div>
    );
  }

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

  // Profile-completion funnel gate -- evaluated only once isAuthenticated is true. A freshly
  // registered user's role starts at 'Unassigned' (backend no longer hardcodes Student) and
  // only reaches the full app below once they've completed a Student profile or been
  // approved as Tutor. Sign-out reuses the same isAuthenticated toggle Navbar's onSignOut
  // uses further down.
  if (user.role === 'Unassigned') {
    return <ProfileSetupPage onSignOut={handleSignOut} />;
  }
  if (user.role === 'PendingTutor') {
    return <PendingApprovalPage onSignOut={handleSignOut} />;
  }
  if (user.role === 'RejectedTutor') {
    return <TutorRejectedPage onSignOut={handleSignOut} />;
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-800 transition-colors duration-200 ${
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
        visibleTabs={visibleTabs}
        availableAdminSubTabs={availableAdminSubTabs}
        activeAdminSubTab={activeAdminSubTab}
        onSelectAdminSubTab={handleSelectAdminSubTab}
        onSignOut={handleSignOut}
        onOpenAccessibility={() => setIsAccessibilityOpen(true)}
        onToggleTheme={() => {}}
        isDarkMode={false}
        onSearchClick={() => setActiveTab('discover')}
      />

      {/* Main Container - 100% Width Layout */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 pb-16 outline-none">
        {/* Crossfades between tabs instead of the old instant unmount+mount swap -- see
            PageTransition.tsx / usePageTransition.ts. contentKey=activeTab drives the fade. */}
        <PageTransition contentKey={activeTab} className="w-full">
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

          {activeTab === 'admin' && (
            visibleTabs.admin ? (
              // Defense-in-depth (plan §5 item 7): the backend is the real enforcement point
              // (every admin write is policy-gated per plan §3), but a stale/local activeTab
              // of 'admin' for a role that shouldn't see it must still not render the panel --
              // hiding the Navbar button alone isn't enough.
              <AdminPanel activeSubTab={activeAdminSubTab} onSubTabChange={setActiveAdminSubTab} />
            ) : (
              <CourseDiscover onOpenCourse={handleOpenCourseOverview} />
            )
          )}
        </PageTransition>
      </main>

      <Footer />

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
