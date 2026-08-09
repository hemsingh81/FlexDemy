import React, { useState } from 'react';
import {
  BookOpen,
  Play,
  Award,
  Clock,
  Flame,
  ArrowRight,
  Compass,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Users,
  Filter,
  Calendar,
  Zap,
  Check,
} from 'lucide-react';
import { UserProgress } from '../../types';
import { useDashboard } from './useDashboard';
import { WeeklyGoalCard } from './WeeklyGoalCard';
import { AdaptiveSchedule } from './AdaptiveSchedule';

interface DashboardProps {
  onOpenCourse: (courseId: string, lessonId?: string) => void;
  onNavigateTab: (tab: 'groups' | 'assignments' | 'certificates' | 'tutor') => void;
  onSearchClick?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenCourse,
  onNavigateTab,
}) => {
  const { user, courses, isLoading } = useDashboard();

  // Grade level tag, search filters, and sorting option
  const [selectedGradeTag, setSelectedGradeTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [courseSortBy, setCourseSortBy] = useState<'recently_accessed' | 'completion_percentage' | 'alphabetical'>('recently_accessed');

  if (isLoading || !user) return null;

  const GRADE_TAGS = ['All', 'Class 10th', 'Class 12th', 'Undergrad / College', 'PhD Level'];

  // Enrolled courses filter & sorting logic
  const enrolledCoursesRaw = courses.filter((c) => user.progress[c.id]);

  const enrolledCourses = [...enrolledCoursesRaw].sort((a, b) => {
    const progA = user.progress[a.id];
    const progB = user.progress[b.id];

    if (courseSortBy === 'completion_percentage') {
      const totalA = a.modules.reduce((acc, m) => acc + m.lessons.length, 0) || 1;
      const completedA = progA?.completedLessonIds.length || 0;
      const percentA = completedA / totalA;

      const totalB = b.modules.reduce((acc, m) => acc + m.lessons.length, 0) || 1;
      const completedB = progB?.completedLessonIds.length || 0;
      const percentB = completedB / totalB;

      return percentB - percentA; // Higher completion first
    }

    if (courseSortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }

    // Default 'recently_accessed'
    const lastAccessA = progA?.lastAccessedAt ? new Date(progA.lastAccessedAt).getTime() : 0;
    const lastAccessB = progB?.lastAccessedAt ? new Date(progB.lastAccessedAt).getTime() : 0;
    return lastAccessB - lastAccessA;
  });

  // Filter recommended/all discovery courses based on Search Query and Grade Level Tag
  const catalogCourses = courses.filter((c) => {
    // Grade tag match
    const matchesGrade =
      selectedGradeTag === 'All' ||
      c.targetGradeTag?.toLowerCase().includes(selectedGradeTag.toLowerCase()) ||
      c.tags?.some((t) => t.toLowerCase().includes(selectedGradeTag.toLowerCase()));

    // Search term match
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.shortDescription.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.tags?.some((tag) => tag.toLowerCase().includes(q));

    return matchesGrade && matchesSearch;
  });

  const recommendedCourses = catalogCourses.filter((c) => !user.progress[c.id]);

  // Overall statistics calculations
  const totalEnrolled = enrolledCourses.length;
  const progressList = Object.values(user.progress) as UserProgress[];
  const totalCompletedLessons = progressList.reduce(
    (acc, p) => acc + (p?.completedLessonIds?.length || 0),
    0
  );
  const totalHoursLearned = (
    progressList.reduce((acc, p) => acc + (p?.timeSpentSeconds || 0), 0) / 3600
  ).toFixed(1);

  return (
    <div className="space-y-8 pb-12 w-full">

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-[#143358] text-white p-6 sm:p-10 shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-[#EC7B38]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-amber-200 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-[#EC7B38]" />
              <span>Learner-Driven Adaptive AI System</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white">
              Welcome back, {user.name}! 👋
            </h1>
            <p className="text-sm sm:text-base text-slate-200 font-normal leading-relaxed">
              You are on a <span className="font-bold text-[#EC7B38]">{user.streakDays}-day learning streak</span>. Ready to dive back into deep interactive explanations with auto-scrolling audio narration?
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {enrolledCourses.length > 0 && (
              <button
                onClick={() => onOpenCourse(enrolledCourses[0].id)}
                className="px-5 py-2.5 bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#EC7B38]/30 flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume {enrolledCourses[0].title.split(' ')[0]}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-[#EC7B38]/10 text-[#EC7B38] border border-[#EC7B38]/20">
            <Flame className="w-6 h-6 fill-[#EC7B38]" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Day Streak</p>
            <p className="text-2xl font-bold font-display text-[#142030]">{user.streakDays} Days</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-[#143358]/10 text-[#143358] border border-[#143358]/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Enrolled Courses</p>
            <p className="text-2xl font-bold font-display text-[#142030]">{totalEnrolled}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Mastery Points</p>
            <p className="text-2xl font-bold font-display text-[#142030]">{user.totalPoints} pts</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-[#179765]/10 text-[#179765] border border-[#179765]/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#5E6A79] font-medium">Time Spent</p>
            <p className="text-2xl font-bold font-display text-[#142030]">{totalHoursLearned} hrs</p>
          </div>
        </div>

      </div>

      {/* Daily Streak Counter & Interactive Visual Bar */}
      <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3.5 rounded-2xl bg-[#EC7B38]/10 text-[#EC7B38] border border-[#EC7B38]/20 flex-shrink-0">
              <Flame className="w-7 h-7 fill-[#EC7B38]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold font-display text-[#142030]">
                  {user.streakDays}-Day Learning Streak! 🔥
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#EC7B38]/10 text-[#EC7B38] border border-[#EC7B38]/30">
                  Active Streak
                </span>
              </div>
              <p className="text-xs text-[#5E6A79] mt-0.5">
                You've completed at least one interactive lesson for {user.streakDays} consecutive days. Keep it up to boost retention!
              </p>
            </div>
          </div>

          {enrolledCourses.length > 0 && (
            <button
              onClick={() => onOpenCourse(enrolledCourses[0].id)}
              className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Extend Streak Today</span>
            </button>
          )}
        </div>

        {/* 7-Day Visual Calendar Tracker */}
        <div className="pt-3 border-t border-[#E1DED4]/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5E6A79] flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-[#143358]" />
              <span>Weekly Consecutive Activity Log</span>
            </span>
            <span className="text-[11px] font-bold text-[#179765] flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Goal: 1 Lesson / Day</span>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
              const isCompleted = idx < Math.min(user.streakDays, 7);
              const isToday = idx === Math.min(user.streakDays - 1, 6);

              return (
                <div
                  key={dayName}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between space-y-1.5 ${
                    isCompleted
                      ? 'bg-[#FAF7EC] border-[#EC7B38]/40 shadow-2xs'
                      : 'bg-white border-[#E1DED4] opacity-60'
                  } ${isToday ? 'ring-2 ring-[#EC7B38]' : ''}`}
                >
                  <span className="text-[10px] font-bold text-[#5E6A79] uppercase">{dayName}</span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-[#EC7B38] text-white shadow-xs' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Flame className="w-4 h-4 fill-white text-white" />
                    ) : (
                      <span className="text-[10px] font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-[#142030]">
                    {isCompleted ? 'Done ✓' : 'Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly Study Goal Setter & Circular Progress Ring */}
      <WeeklyGoalCard currentHoursLearned={Number(totalHoursLearned)} />

      {/* Adaptive Study Schedule Calendar & Goal Sync */}
      <AdaptiveSchedule
        courses={courses}
        weeklyGoalHours={user.weeklyGoalHours || 10}
        onOpenCourse={onOpenCourse}
      />

      {/* Main Grid: My Courses vs Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (2/3): My Courses & Integrated Discover Catalog */}
        <div className="lg:col-span-2 space-y-8">

          {/* Section 1: In Progress Courses */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold font-display text-[#142030]">
                  My Courses ({enrolledCourses.length})
                </h2>
                <p className="text-xs text-[#5E6A79]">
                  Continue learning with interactive text narration and 5-level drilldowns.
                </p>
              </div>

              {/* Course Sorting Dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#5E6A79] flex items-center space-x-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#143358]" />
                  <span>Sort By:</span>
                </span>
                <select
                  value={courseSortBy}
                  onChange={(e) => setCourseSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-[#E1DED4] rounded-xl text-xs font-bold text-[#142030] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#EC7B38] cursor-pointer"
                >
                  <option value="recently_accessed">Recently Accessed</option>
                  <option value="completion_percentage">Completion Percentage</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            {enrolledCourses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#FAF7EC] border border-dashed border-[#E1DED4] space-y-3">
                <Compass className="w-10 h-10 mx-auto text-[#5E6A79]" />
                <p className="text-sm font-semibold text-[#142030]">No enrolled courses yet</p>
                <p className="text-xs text-[#5E6A79]">Browse the course catalog below to enroll in interactive courses.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {enrolledCourses.map((course) => {
                  const prog = user.progress[course.id];
                  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
                  const completedCount = prog?.completedLessonIds.length || 0;
                  const percent = Math.round((completedCount / totalLessons) * 100) || 15;

                  return (
                    <div
                      key={course.id}
                      className="p-5 rounded-2xl bg-white border border-[#E1DED4] hover:border-[#EC7B38] shadow-xs hover:shadow-xl hover:shadow-[#143358]/10 hover:-translate-y-1.5 transition-all duration-300 ease-out flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group cursor-pointer"
                    >
                      <div className="flex items-start space-x-4">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-16 h-16 rounded-xl object-cover border border-[#E1DED4] flex-shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#143358]/10 text-[#143358] border border-[#143358]/20">
                              {course.subject.replace('_', ' ')}
                            </span>
                            {course.targetGradeTag && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF7EC] text-[#EC7B38] border border-[#EC7B38]/30">
                                {course.targetGradeTag}
                              </span>
                            )}
                            <span className="text-xs text-[#5E6A79]">· {course.level}</span>
                          </div>
                          <h3 className="text-lg font-bold font-display text-[#142030] group-hover:text-[#143358] transition-colors">
                            {course.title}
                          </h3>
                          <p className="text-xs text-[#5E6A79]">
                            Instructor: {course.instructor.name}
                          </p>

                          {/* Course Overall Progress Bar */}
                          <div className="w-full max-w-md pt-2 space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-[#5E6A79]">
                                <span className="font-semibold text-[#142030]">Course Progress: {completedCount} / {totalLessons} Lessons</span>
                                <span className="font-bold text-[#179765]">{percent}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-[#FAF7EC] overflow-hidden border border-[#E1DED4]">
                                <div
                                  className="h-full bg-[#179765] rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>

                            {/* Course Module Progress Bars */}
                            <div className="pt-2 border-t border-[#E1DED4]/60 space-y-2">
                              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#143358] flex items-center space-x-1">
                                <BookOpen className="w-3.5 h-3.5 text-[#EC7B38]" />
                                <span>Course Modules Progress ({course.modules.length})</span>
                              </p>

                              <div className="grid grid-cols-1 gap-2">
                                {course.modules.map((mod, modIdx) => {
                                  const modTotal = mod.lessons.length || 1;
                                  const modCompleted = mod.lessons.filter((l) =>
                                    prog?.completedLessonIds?.includes(l.id)
                                  ).length;
                                  const modPct = Math.round((modCompleted / modTotal) * 100);
                                  const modRelativePct = Math.round((modCompleted / totalLessons) * 100);

                                  return (
                                    <div
                                      key={mod.id}
                                      className="p-2.5 rounded-xl bg-[#FAF7EC]/80 border border-[#E1DED4] space-y-1"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#142030] truncate max-w-[220px]">
                                          {modIdx + 1}. {mod.title}
                                        </span>
                                        <div className="flex items-center space-x-2 shrink-0">
                                          <span className="text-[#5E6A79] text-[10px]">
                                            {modCompleted}/{modTotal} lessons ({modRelativePct}% of course)
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                            modPct === 100
                                              ? 'bg-[#179765]/10 text-[#179765] font-extrabold'
                                              : 'bg-[#143358]/10 text-[#143358]'
                                          }`}>
                                            {modPct}%
                                          </span>
                                        </div>
                                      </div>

                                      {/* Module Visual Progress Bar */}
                                      <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-[#E1DED4]">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            modPct === 100 ? 'bg-[#179765]' : 'bg-[#EC7B38]'
                                          }`}
                                          style={{ width: `${modPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenCourse(course.id)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all flex-shrink-0"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Continue Learning</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (1/3): Quick Activity Feed & Group Rooms */}
        <div className="space-y-6">

          {/* Quick Group Room Join */}
          <div className="p-5 rounded-2xl bg-[#143358] border border-white/10 text-white shadow-md space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-white/10 text-amber-300 border border-white/15">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-display text-white">Synchronous Study Rooms</h3>
                <p className="text-xs text-slate-200">Study with peers in real-time with shared audio reader.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('groups')}
              className="w-full py-2.5 bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              <span>Join Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs space-y-4">
            <h3 className="text-base font-bold font-display text-[#142030] flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#143358]" />
              <span>Recent Activity</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#179765] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[#142030]">Completed "1.1 Superposition and Bloch Sphere"</p>
                  <p className="text-[10px] text-[#5E6A79]">Quantum Computing · 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs">
                <Award className="w-4 h-4 text-[#EC7B38] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[#142030]">Scored 95% on Superposition Quiz</p>
                  <p className="text-[10px] text-[#5E6A79]">Earned +150 Mastery Points</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs">
                <Users className="w-4 h-4 text-[#143358] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[#142030]">Joined "Quantum Physics Enthusiasts" Room</p>
                  <p className="text-[10px] text-[#5E6A79]">4 Active Peers</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
