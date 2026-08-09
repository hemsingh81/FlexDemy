import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Star,
  Play,
  ArrowLeft,
  NotebookPen,
  MessageSquare,
  Sparkles,
  UserCheck,
  Award,
  Layers,
  FileText,
  Share2,
  Bookmark,
  Plus,
  Send,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { Course, UserProgress, ScratchpadNote } from '../../types';
import { CourseReviewModal } from './CourseReviewModal';
import { useCourseOverview } from './useCourseOverview';

interface CourseOverviewScreenProps {
  course: Course;
  progress?: UserProgress;
  onStartLesson: (courseId: string, lessonId?: string) => void;
  onBack: () => void;
}

export const CourseOverviewScreen: React.FC<CourseOverviewScreenProps> = ({
  course,
  progress,
  onStartLesson,
  onBack,
}) => {
  const { reviewsList, notesList, refreshReviews, addCourseNote } = useCourseOverview(course);
  const [activeTab, setActiveTab] = useState<'section-chapters' | 'section-progress' | 'section-notes' | 'section-reviews'>('section-chapters');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<boolean>(false);

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = progress?.completedLessonIds?.length || 0;
  const overallPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const avgRating =
    reviewsList.length > 0
      ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1)
      : course.rating.toFixed(1);

  const lastLessonId = progress?.lastLessonId || course.modules[0]?.lessons[0]?.id;

  const handleAddQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const firstLesson = course.modules[0]?.lessons[0];
    const createdNote: ScratchpadNote = {
      id: `note_${Date.now()}`,
      courseId: course.id,
      lessonId: firstLesson?.id || 'l1',
      lessonTitle: firstLesson?.title || 'General Course Note',
      paragraphIndex: 0,
      content: newNoteText.trim(),
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    addCourseNote(createdNote);
    setNewNoteText('');
  };

  const handleShareCourse = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  };

  const scrollToSection = (sectionId: 'section-chapters' | 'section-progress' | 'section-notes' | 'section-reviews') => {
    setActiveTab(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-8 lg:px-12 space-y-8 animate-fade-in pb-16">

      {/* Top Navigation Row */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 bg-white hover:bg-slate-100 text-[#142030] font-bold text-xs rounded-xl border border-[#E1DED4] flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#EC7B38]" />
          <span>Back to Courses</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleShareCourse}
            className="p-2.5 bg-white hover:bg-slate-100 text-[#142030] rounded-xl border border-[#E1DED4] transition-all cursor-pointer shadow-xs"
            title="Share course link"
          >
            <Share2 className="w-4 h-4 text-[#5E6A79]" />
          </button>
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
              bookmarked
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-[#142030] border-[#E1DED4] hover:bg-slate-100'
            }`}
            title="Bookmark course"
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-white' : 'text-[#5E6A79]'}`} />
          </button>
        </div>
      </div>

      {shareToast && (
        <div className="p-3 bg-[#179765] text-white rounded-2xl text-xs font-bold text-center flex items-center justify-center space-x-2 shadow-md animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Course link copied to clipboard!</span>
        </div>
      )}

      {/* Course Banner Hero Header Card - 100% Full Width */}
      <div className="p-6 sm:p-8 lg:p-10 rounded-3xl bg-white border border-[#E1DED4] shadow-xs relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-[#143358]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 items-center">
          {/* Thumbnail */}
          <div className="relative group md:col-span-1">
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-52 sm:h-64 rounded-2xl object-cover border border-[#E1DED4] shadow-sm"
            />
            {course.targetGradeTag && (
              <span className="absolute top-3 left-3 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#143358] text-white shadow-md">
                {course.targetGradeTag}
              </span>
            )}
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-xs font-bold flex items-center space-x-1 border border-white/20">
              <Star className="w-3.5 h-3.5 fill-[#EC7B38] text-[#EC7B38]" />
              <span>{avgRating} ({reviewsList.length} reviews)</span>
            </div>
          </div>

          {/* Details & Actions */}
          <div className="md:col-span-2 lg:col-span-3 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#EC7B38]">
                <span>{course.subject.replace('_', ' ')}</span>
                <span>•</span>
                <span>{course.level} Level</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display text-[#142030] leading-tight">
                {course.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#5E6A79] leading-relaxed pt-1">
                {course.description}
              </p>
            </div>

            {/* Instructor & Learner Meta Badge */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#E1DED4]">
              <div className="flex items-center space-x-2.5">
                <img
                  src={course.instructor.avatar}
                  alt={course.instructor.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#143358]"
                />
                <div>
                  <h4 className="text-xs font-bold text-[#142030]">{course.instructor.name}</h4>
                  <p className="text-[10px] text-[#5E6A79]">{course.instructor.title}</p>
                </div>
              </div>

              <div className="h-8 w-px bg-[#E1DED4] hidden sm:block" />

              <div className="flex items-center space-x-6 text-xs font-semibold text-[#5E6A79]">
                <div className="flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-[#143358]" />
                  <span>{totalLessons} Lessons</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-[#179765]" />
                  <span>{course.durationMinutes || 45} Mins</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <GraduationCap className="w-4 h-4 text-[#EC7B38]" />
                  <span>{overallPercent}% Progress</span>
                </div>
              </div>
            </div>

            {/* Primary Action Button: Start / Resume Learning */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => onStartLesson(course.id, lastLessonId)}
                className="px-8 py-3.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center space-x-2.5 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>{completedCount > 0 ? 'Resume Course Learning' : 'Start Reading Course'}</span>
              </button>

              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="px-5 py-3.5 bg-[#FAF7EC] hover:bg-amber-500 hover:text-white text-amber-800 font-bold text-xs rounded-2xl border border-amber-200/80 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Write Course Review</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Top Scroll Navigation Bar */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#E1DED4] shadow-xs flex items-center space-x-2 overflow-x-auto">
        {[
          { id: 'section-chapters', label: '1. Chapters & Lessons', icon: Layers, count: totalLessons },
          { id: 'section-progress', label: '2. Overall Progress', icon: GraduationCap, count: `${overallPercent}%` },
          { id: 'section-notes', label: '3. Attached Study Notes', icon: NotebookPen, count: notesList.length },
          { id: 'section-reviews', label: '4. Student Reviews', icon: MessageSquare, count: reviewsList.length },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap border ${
                isActive
                  ? 'bg-[#143358] text-white border-[#143358] shadow-xs'
                  : 'bg-[#FAF7EC] text-[#142030] border-[#E1DED4] hover:bg-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#EC7B38]' : 'text-[#5E6A79]'}`} />
              <span>{item.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                isActive ? 'bg-white/20 text-white' : 'bg-white text-[#5E6A79] border border-[#E1DED4]'
              }`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SEQUENTIAL FULL-WIDTH CONTENT SECTIONS */}
      <div className="space-y-12">

        {/* SECTION 1: CHAPTERS & LESSONS */}
        <section id="section-chapters" className="scroll-mt-32 space-y-6">
          <div className="flex items-center justify-between border-b border-[#E1DED4] pb-3">
            <h3 className="text-xl font-bold font-display text-[#142030] flex items-center space-x-2">
              <Layers className="w-5 h-5 text-[#EC7B38]" />
              <span>1. Course Syllabus ({course.modules.length} Modules)</span>
            </h3>
            <span className="text-xs text-[#5E6A79]">
              Click any lesson to launch reader immediately
            </span>
          </div>

          <div className="space-y-4">
            {course.modules.map((module, modIdx) => {
              const modTotal = module.lessons.length;
              const modCompleted = module.lessons.filter((l) =>
                progress?.completedLessonIds?.includes(l.id)
              ).length;
              const modPct = modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0;

              return (
                <div
                  key={module.id}
                  className="p-6 bg-white rounded-3xl border border-[#E1DED4] shadow-xs space-y-4"
                >
                  {/* Module Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1DED4] pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-9 h-9 rounded-xl bg-[#FAF7EC] text-[#143358] border border-[#E1DED4] font-extrabold text-xs flex items-center justify-center shrink-0">
                        M{modIdx + 1}
                      </span>
                      <div>
                        <h4 className="text-base font-bold text-[#142030]">{module.title}</h4>
                        <span className="text-xs text-[#5E6A79]">
                          {modCompleted} of {modTotal} lessons completed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2.5 bg-[#FAF7EC] rounded-full overflow-hidden border border-[#E1DED4]">
                        <div
                          className="h-full bg-[#179765] rounded-full transition-all duration-300"
                          style={{ width: `${modPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-extrabold text-[#179765]">{modPct}%</span>
                    </div>
                  </div>

                  {/* Lesson Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {module.lessons.map((lesson, lIdx) => {
                      const isCompleted = progress?.completedLessonIds?.includes(lesson.id);

                      return (
                        <div
                          key={lesson.id}
                          className="p-4 rounded-2xl bg-[#FAF7EC]/80 border border-[#E1DED4] hover:border-[#EC7B38] flex items-center justify-between transition-all group"
                        >
                          <div className="flex items-center space-x-3 truncate min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                              isCompleted
                                ? 'bg-[#179765] text-white border-[#179765]'
                                : 'bg-white text-[#143358] border-[#E1DED4]'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <BookOpen className="w-4 h-4 text-[#EC7B38]" />
                              )}
                            </div>

                            <div className="truncate min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-[#142030] group-hover:text-[#EC7B38] transition-colors truncate">
                                {modIdx + 1}.{lIdx + 1} {lesson.title}
                              </h5>
                              <div className="flex items-center space-x-3 text-[10px] text-[#5E6A79] mt-0.5">
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{lesson.durationMinutes} mins</span>
                                </span>
                                {lesson.assignment && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#143358]/10 text-[#143358] font-bold">
                                    Quiz Assignment
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => onStartLesson(course.id, lesson.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs flex items-center space-x-1 shrink-0 transition-all cursor-pointer"
                          >
                            <span>Read</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: OVERALL PROGRESS */}
        <section id="section-progress" className="scroll-mt-32 p-6 sm:p-8 bg-white rounded-3xl border border-[#E1DED4] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E1DED4] pb-4">
            <div>
              <h3 className="text-xl font-bold font-display text-[#142030] flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-[#179765]" />
                <span>2. Detailed Course Progress</span>
              </h3>
              <p className="text-xs text-[#5E6A79]">Track completed lessons, total reading time, and module metrics.</p>
            </div>
            <span className="text-3xl font-extrabold text-[#179765]">{overallPercent}%</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
              <span className="text-xs text-[#5E6A79] font-medium">Lessons Completed</span>
              <p className="text-2xl font-extrabold text-[#142030]">{completedCount} / {totalLessons}</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
              <span className="text-xs text-[#5E6A79] font-medium">Time Spent Reading</span>
              <p className="text-2xl font-extrabold text-[#142030]">
                {Math.round((progress?.timeSpentSeconds || 0) / 60)} Mins
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
              <span className="text-xs text-[#5E6A79] font-medium">Enrolled Date</span>
              <p className="text-2xl font-extrabold text-[#142030]">{progress?.enrolledDate || 'Today'}</p>
            </div>
          </div>

          {/* Module Breakdown List */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold text-[#142030] uppercase tracking-wider">Module Completion Progress</h4>
            {course.modules.map((mod, idx) => {
              const modTotal = mod.lessons.length || 1;
              const modDone = mod.lessons.filter((l) => progress?.completedLessonIds?.includes(l.id)).length;
              const pct = Math.round((modDone / modTotal) * 100);

              return (
                <div key={mod.id} className="p-4 rounded-2xl bg-[#FAF7EC]/80 border border-[#E1DED4] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#142030]">Module {idx + 1}: {mod.title}</span>
                    <span className="text-[#179765]">{modDone}/{modTotal} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-[#E1DED4]">
                    <div className="h-full bg-[#179765] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: ATTACHED STUDY NOTES */}
        <section id="section-notes" className="scroll-mt-32 p-6 sm:p-8 bg-white rounded-3xl border border-[#E1DED4] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E1DED4] pb-4">
            <div>
              <h3 className="text-xl font-bold font-display text-[#142030] flex items-center space-x-2">
                <NotebookPen className="w-5 h-5 text-[#EC7B38]" />
                <span>3. Course Study Notes</span>
              </h3>
              <p className="text-xs text-[#5E6A79]">Your personal scratchpad notes attached to this course.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-[#FAF7EC] rounded-full border border-[#E1DED4] text-[#142030]">
              {notesList.length} Notes Saved
            </span>
          </div>

          {/* Add Quick Course Note Form */}
          <form onSubmit={handleAddQuickNote} className="p-5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-3">
            <label className="text-xs font-bold text-[#142030] block">Add Quick Study Note</label>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Jot down a key insight, formula, or reminder for this course..."
              rows={2}
              className="w-full p-3.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newNoteText.trim()}
                className="px-5 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Save Course Note</span>
              </button>
            </div>
          </form>

          {/* Saved Notes List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notesList.length === 0 ? (
              <p className="col-span-full text-center py-6 text-xs text-[#5E6A79]">No notes saved for this course yet.</p>
            ) : (
              notesList.map((note) => (
                <div key={note.id} className="p-4 rounded-2xl bg-[#FAF7EC]/80 border border-[#E1DED4] space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#143358]">
                      <span>📌 {note.lessonTitle}</span>
                      <span className="text-[10px] text-[#5E6A79] font-normal">{note.createdAt}</span>
                    </div>
                    <p className="text-xs text-[#142030] leading-relaxed whitespace-pre-wrap">{note.content || (note as any).text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* SECTION 4: STUDENT REVIEWS */}
        <section id="section-reviews" className="scroll-mt-32 p-6 sm:p-8 bg-white rounded-3xl border border-[#E1DED4] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E1DED4] pb-4">
            <div>
              <h3 className="text-xl font-bold font-display text-[#142030] flex items-center space-x-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span>4. Student Reviews & Comments</span>
              </h3>
              <p className="text-xs text-[#5E6A79]">Verified feedback from peers who completed this course.</p>
            </div>

            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-4 py-2 bg-[#143358] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Leave Review</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reviewsList.map((rev) => (
              <div key={rev.id} className="p-5 bg-[#FAF7EC]/80 rounded-2xl border border-[#E1DED4] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img src={rev.userAvatar} alt={rev.userName} className="w-9 h-9 rounded-full object-cover border border-[#E1DED4]" />
                    <div>
                      <h4 className="text-xs font-bold text-[#142030]">{rev.userName}</h4>
                      <span className="text-[10px] text-[#5E6A79]">{rev.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#5E6A79] leading-relaxed">"{rev.reviewText}"</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Course Review Modal */}
      <CourseReviewModal
        course={course}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSaveReview={() => {
          refreshReviews();
        }}
      />

    </div>
  );
};
