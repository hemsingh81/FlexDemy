import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/features/Dashboard/Dashboard';
import { useDashboard } from '@/src/features/Dashboard/useDashboard';
import { Course, UserProfile } from '@/src/types';

vi.mock('@/src/features/Dashboard/useDashboard');

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: '',
  fullDescription: '',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 5,
  enrolledCount: 10,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [{ id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {} }],
    },
  ],
  prerequisites: [],
};

const studentUser: UserProfile = {
  id: 'usr_1',
  name: 'Hem Singh',
  email: '',
  avatar: '',
  role: 'Student',
  streakDays: 4,
  totalPoints: 250,
  isDarkMode: false,
  progress: {
    course_1: {
      courseId: 'course_1',
      completedLessonIds: [],
      lastLessonId: 'l1',
      lastSentenceIndex: 0,
      assignmentScores: {},
      timeSpentSeconds: 0,
      enrolledDate: '2026-01-01',
    },
  },
};

const tutorUser: UserProfile = {
  ...studentUser,
  id: 'tutor_1',
  name: 'Dr. Elena Rostova',
  role: 'Tutor',
  progress: {},
};

const masterUser: UserProfile = {
  ...studentUser,
  id: 'master_1',
  name: 'Admin Master',
  role: 'Master',
};

// Shape returned by useTutorHub() -- passed to Dashboard as a prop (App.tsx owns the hook so
// AppointmentToast can share the same fetched state). One real slot lets the Master-preview
// empty-state assertion actually prove something (data is real for the student, empty in demo).
const makeTutorHub = () => ({
  user: studentUser,
  isLoading: false,
  courses: [course],
  tutorSlots: [
    {
      id: 'slot_1',
      tutorId: 'tutor_1',
      tutorName: 'Dr. Elena Rostova',
      tutorAvatar: '',
      date: '2026-08-10',
      startTime: '02:00 PM',
      endTime: '03:00 PM',
      durationMinutes: 60,
      isBooked: false,
      sessionType: 'one_on_one' as const,
      ratePerMinute: 1.5,
      topic: 'Quantum Vectors',
    },
  ],
  groupRequests: [],
  publicClasses: [],
  addCourse: vi.fn(),
  bookSlot: vi.fn(),
  updateSlot: vi.fn(),
  requestGroupClass: vi.fn(),
  subscribePublicClass: vi.fn(),
  announcePublicClass: vi.fn(),
});

// Shape returned by useAssignmentsHub() -- passed to Dashboard as a prop (App.tsx owns the
// hook, same reasoning as tutorHub).
const makeAssignmentsHub = () => ({
  user: studentUser,
  courses: [course],
  courseAssignments: [],
  tutorAssignments: [],
  submissions: [],
  isLoading: false,
  submitQuiz: vi.fn(),
  createAssignment: vi.fn(),
  publishAssignment: vi.fn(),
  unpublishAssignment: vi.fn(),
  reviewSubmission: vi.fn(),
  reEvaluateSubmission: vi.fn(),
});

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing while loading', () => {
    vi.mocked(useDashboard).mockReturnValue({ user: null, courses: [], isLoading: true });
    const { container } = render(
      <Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('Student role', () => {
    beforeEach(() => {
      vi.mocked(useDashboard).mockReturnValue({ user: studentUser, courses: [course], isLoading: false });
    });

    it('renders the Student Dashboard, with the merged tutor-booking section and no admin preview toggle', () => {
      render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      expect(screen.getByText(/Welcome back, Hem Singh/)).toBeInTheDocument();
      // Merged from the former Tutor Hub & Booking tab (FR-9/FR-10).
      expect(screen.getByText('Student Session Booking Portal')).toBeInTheDocument();
      expect(screen.queryByText('Preview Tutor Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Educator & Instructor Studio')).not.toBeInTheDocument();
    });

    it('calls onOpenCourse with the course id when continuing an enrolled course', async () => {
      const onOpenCourse = vi.fn();
      const u = userEvent.setup();
      render(<Dashboard onOpenCourse={onOpenCourse} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      await u.click(screen.getByText('Continue Learning'));
      expect(onOpenCourse).toHaveBeenCalledWith('course_1');
    });
  });

  describe('Tutor role', () => {
    it('renders the Tutor Dashboard directly, with no admin preview toggle and no Student widgets', () => {
      vi.mocked(useDashboard).mockReturnValue({ user: tutorUser, courses: [course], isLoading: false });
      render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      expect(screen.getByText('Educator & Instructor Studio')).toBeInTheDocument();
      expect(screen.queryByText('Preview Tutor Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    });
  });

  describe('Master role (FR-3 preview toggle)', () => {
    beforeEach(() => {
      vi.mocked(useDashboard).mockReturnValue({ user: masterUser, courses: [course], isLoading: false });
    });

    it('defaults to the Student Dashboard with the preview toggle visible', () => {
      render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      expect(screen.getByText(/Welcome back, Admin Master/)).toBeInTheDocument();
      expect(screen.getByText('Preview Tutor Dashboard')).toBeInTheDocument();
    });

    it('toggling to the Tutor Dashboard preview renders it in an empty/demo state, not the real tutor data', async () => {
      const u = userEvent.setup();
      render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      await u.click(screen.getByText('Preview Tutor Dashboard'));

      expect(screen.getByText('Educator & Instructor Studio')).toBeInTheDocument();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      // Real tutorSlots (from tutorHub) has a "Quantum Vectors" 1-on-1 slot -- the demo view
      // must not surface it.
      expect(screen.queryByText('Quantum Vectors')).not.toBeInTheDocument();
    });

    it('toggling back returns to the Student Dashboard', async () => {
      const u = userEvent.setup();
      render(<Dashboard onOpenCourse={vi.fn()} onNavigateTab={vi.fn()} tutorHub={makeTutorHub()} assignmentsHub={makeAssignmentsHub()} />);

      await u.click(screen.getByText('Preview Tutor Dashboard'));
      await u.click(screen.getByText('Student Dashboard'));

      expect(screen.getByText(/Welcome back, Admin Master/)).toBeInTheDocument();
    });
  });
});
