import React, { useState } from 'react';
import {
  Search,
  Filter,
  Star,
  Clock,
  BookOpen,
  User,
  Check,
  Sparkles,
  ArrowRight,
  X,
  Play,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { Course, SubjectCategory, DifficultyLevel } from '../../types';
import { translate } from '../../lib/i18n';
import { CourseReviewModal } from '../CourseOverview/CourseReviewModal';
import { getReviewsForCourse } from '../../services/reviewsService';
import { useCourseDiscover } from './useCourseDiscover';

interface CourseDiscoverProps {
  onOpenCourse: (courseId: string) => void;
  initialSearchQuery?: string;
}

export const CourseDiscover: React.FC<CourseDiscoverProps> = ({
  onOpenCourse,
  initialSearchQuery = '',
}) => {
  const { courses, userLanguage, isLoading } = useCourseDiscover();

  const [search, setSearch] = useState(initialSearchQuery);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [reviewCourse, setReviewCourse] = useState<Course | null>(null);

  if (isLoading) return null;

  const t = (key: string) => translate(key, userLanguage as any);

  // Enrolled / Running courses
  const runningCourses = courses.filter((c) => c.enrolledCount > 0 || c.id === 'course_quantum_101');

  // Filter logic
  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.shortDescription.toLowerCase().includes(search.toLowerCase()) ||
      course.subject.toLowerCase().includes(search.toLowerCase());

    const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;
    const matchesLevel = selectedLevel === 'all' || course.level === selectedLevel;

    return matchesSearch && matchesSubject && matchesLevel;
  });

  return (
    <div className="space-y-10 pb-12 w-full">

      {/* SECTION 1: Discover Course Library Header & Search Controls (Top of Screen) */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#142030] flex items-center space-x-2.5">
            <Search className="w-7 h-7 text-[#143358]" />
            <span>Discover Course Library</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6A79] mt-1">
            Search and filter by target grade, subject, and difficulty level to enroll in new interactive AI-powered courses.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-3xl">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-[#5E6A79]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_courses_placeholder')}
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-[#E1DED4] rounded-2xl text-sm shadow-xs focus:ring-2 focus:ring-[#EC7B38] text-[#142030] placeholder-[#5E6A79]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-3.5 p-1 text-[#5E6A79] hover:text-[#142030] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">

          <span className="text-xs font-bold text-[#5E6A79] flex items-center mr-2">
            <Filter className="w-3.5 h-3.5 mr-1 text-[#5E6A79]" />
            <span>Subject:</span>
          </span>

          {[
            { id: 'all', label: 'All Subjects' },
            { id: 'quantum_physics', label: 'Physics' },
            { id: 'chemistry', label: 'Chemistry' },
            { id: 'mathematics', label: 'Math' },
            { id: 'computer_science', label: 'Computer Sci' },
            { id: 'biology', label: 'Biology' },
          ].map((subj) => (
            <button
              key={subj.id}
              onClick={() => setSelectedSubject(subj.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                selectedSubject === subj.id
                  ? 'bg-[#143358] text-white border-[#143358] shadow-xs'
                  : 'bg-white text-[#142030] border-[#E1DED4] hover:bg-[#FAF7EC]'
              }`}
            >
              {subj.label}
            </button>
          ))}

          <div className="h-4 border-r border-[#E1DED4] mx-2 hidden sm:block"></div>

          <span className="text-xs font-bold text-[#5E6A79] flex items-center mr-2">
            <span>Level:</span>
          </span>

          {['all', 'Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-[#EC7B38] text-white border-[#EC7B38] shadow-xs'
                  : 'bg-white text-[#142030] border-[#E1DED4] hover:bg-[#FAF7EC]'
              }`}
            >
              {lvl === 'all' ? 'All Levels' : lvl}
            </button>
          ))}

        </div>
      </div>

      {/* SECTION 2: My Active & Running Courses (Udemy Homepage Style - After Search) */}
      {runningCourses.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#E1DED4]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#142030] flex items-center space-x-2">
              <Play className="w-5 h-5 text-[#EC7B38] fill-[#EC7B38]" />
              <span>My Active & Running Courses ({runningCourses.length})</span>
            </h2>
            <span className="text-xs text-[#5E6A79] font-medium hidden sm:inline">
              Jump straight into your active lessons & player
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {runningCourses.map((course) => {
              const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
              const completedLessons = course.modules.flatMap((m) => m.lessons).filter((l) => l.isCompleted).length;
              const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 35;

              return (
                <div
                  key={course.id}
                  className="p-5 rounded-2xl bg-white border border-[#E1DED4] shadow-xs hover:border-[#EC7B38] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#143358]/10 transition-all duration-300 ease-out flex flex-col justify-between space-y-4 group cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-14 h-14 rounded-xl object-cover border border-[#E1DED4]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#FAF7EC] text-[#143358] border border-[#E1DED4]">
                            {course.targetGradeTag || 'Active'}
                          </span>
                          <span className="text-[10px] font-bold text-[#5E6A79] flex items-center space-x-1 bg-[#FAF7EC] px-1.5 py-0.5 rounded-md border border-[#E1DED4]">
                            <Clock className="w-3 h-3 text-[#EC7B38]" />
                            <span>Est: ~{course.modules.reduce((acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + (l.durationMinutes || 12), 0), 0)} mins</span>
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#142030] truncate mt-1 group-hover:text-[#143358] transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-[11px] text-[#5E6A79] truncate">
                          {course.instructor.name}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[#5E6A79]">Lesson Progress:</span>
                        <span className="text-[#EC7B38]">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#EC7B38] h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenCourse(course.id)}
                    className="w-full py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-md shadow-[#143358]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <span>Continue Learning</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: All Available Courses Catalog */}
      <div className="space-y-6 pt-4 border-t border-[#E1DED4]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[#142030] flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#143358]" />
            <span>Course Catalog ({filteredCourses.length})</span>
          </h2>
          <span className="text-xs text-[#5E6A79] font-medium">
            Showing filtered courses matching your search above
          </span>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-[#E1DED4]">
            <BookOpen className="w-12 h-12 mx-auto text-[#5E6A79] mb-3" />
            <h3 className="text-base font-bold text-[#142030]">No courses match your query</h3>
            <p className="text-xs text-[#5E6A79] mt-1">Try clearing your search keyword or selected category filters.</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedSubject('all');
                setSelectedLevel('all');
              }}
              className="mt-4 px-5 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const reviews = getReviewsForCourse(course.id);
              const computedRating = reviews.length > 0
                ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                : course.rating.toFixed(1);

              return (
                <div
                  key={course.id}
                  className="group rounded-3xl bg-white border border-[#E1DED4] shadow-xs hover:border-[#EC7B38] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#143358]/10 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-pointer"
                >
                  <div>

                    {/* Course Thumbnail */}
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <span className="absolute top-3 left-3 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full bg-[#143358] text-white shadow-md">
                        {course.subject.replace('_', ' ')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewCourse(course);
                        }}
                        className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center space-x-1 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/20 hover:bg-[#EC7B38] transition-all cursor-pointer"
                        title="View and leave course reviews & 5-star ratings"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#EC7B38] text-[#EC7B38]" />
                        <span>{computedRating}</span>
                        <span className="text-slate-200 text-[10px]">({reviews.length > 0 ? `${reviews.length} reviews` : `${course.enrolledCount} learners`})</span>
                      </button>
                    </div>

                    {/* Body Content */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#EC7B38]">{course.level}</span>
                        <span className="flex items-center space-x-1 text-[#143358] font-bold text-[11px] bg-[#FAF7EC] px-2 py-0.5 rounded-md border border-[#E1DED4]">
                          <Clock className="w-3 h-3 text-[#EC7B38]" />
                          <span>Est. Reading Time: ~{course.modules.reduce((acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + (l.durationMinutes || 12), 0), 0)} mins</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#142030] group-hover:text-[#143358] transition-colors line-clamp-2">
                        {course.title}
                      </h3>

                      <p className="text-xs text-[#5E6A79] line-clamp-2 leading-relaxed">
                        {course.shortDescription}
                      </p>

                      {/* Instructor Info & Reviews Link */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E1DED4]">
                        <div className="flex items-center space-x-2">
                          <img
                            src={course.instructor.avatar}
                            alt={course.instructor.name}
                            className="w-6 h-6 rounded-full object-cover border border-[#E1DED4]"
                          />
                          <span className="text-xs text-[#142030] font-medium truncate max-w-[140px]">
                            {course.instructor.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReviewCourse(course)}
                          className="text-[11px] font-extrabold text-[#143358] hover:text-[#EC7B38] flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#EC7B38]" />
                          <span>Rate / Review</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Footer Buttons */}
                  <div className="p-5 pt-0 flex items-center space-x-2">
                    <button
                      onClick={() => setPreviewCourse(course)}
                      className="flex-1 py-2.5 bg-[#FAF7EC] hover:bg-slate-100 text-[#142030] font-bold text-xs rounded-xl transition-colors border border-[#E1DED4] cursor-pointer"
                    >
                      Preview Syllabus
                    </button>
                    <button
                      onClick={() => onOpenCourse(course.id)}
                      className="flex-1 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-md shadow-[#143358]/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{t('enroll_now')}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Course Preview Modal */}
      {previewCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E1DED4] p-6 sm:p-8 max-h-[90vh] overflow-y-auto text-[#142030]">

            <button
              onClick={() => setPreviewCourse(null)}
              aria-label="Close preview"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <img
                  src={previewCourse.thumbnail}
                  alt={previewCourse.title}
                  className="w-24 h-24 rounded-2xl object-cover border border-[#E1DED4]"
                />
                <div>
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7EC] text-[#143358] border border-[#E1DED4]">
                    {previewCourse.subject.replace('_', ' ')}
                  </span>
                  <h2 className="text-xl font-bold text-[#142030] mt-1">
                    {previewCourse.title}
                  </h2>
                  <p className="text-xs text-[#5E6A79] mt-1">
                    Instructor: {previewCourse.instructor.name} · {previewCourse.instructor.role}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#142030] leading-relaxed">
                {previewCourse.fullDescription}
              </p>

              {/* Module Syllabus Accordion */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#142030] flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#143358]" />
                  <span>Module Syllabus & Lessons</span>
                </h3>

                <div className="space-y-2">
                  {previewCourse.modules.map((mod) => {
                    const modReadingTime = mod.lessons.reduce(
                      (acc, l) => acc + (l.durationMinutes || 12),
                      0
                    );
                    return (
                      <div key={mod.id} className="p-3.5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#142030]">{mod.title}</p>
                          <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-extrabold text-[#143358] bg-white px-2.5 py-0.5 rounded-md border border-[#E1DED4] shadow-2xs">
                            <Clock className="w-3 h-3 text-[#EC7B38]" />
                            <span>Estimated Reading Time: ~{modReadingTime} mins</span>
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1 pl-3 text-xs text-[#5E6A79]">
                          {mod.lessons.map((lesson) => (
                            <li key={lesson.id} className="flex items-center justify-between">
                              <span>• {lesson.title}</span>
                              <span className="text-[10px] text-[#5E6A79]">{lesson.durationMinutes || 12} mins</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E1DED4]">
                <button
                  onClick={() => setPreviewCourse(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#5E6A79] hover:text-[#142030] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const cid = previewCourse.id;
                    setPreviewCourse(null);
                    onOpenCourse(cid);
                  }}
                  className="px-5 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-md shadow-[#143358]/20 flex items-center space-x-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Enroll & Start Player Now</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Course Review & Rating Modal */}
      {reviewCourse && (
        <CourseReviewModal
          course={reviewCourse}
          isOpen={!!reviewCourse}
          onClose={() => setReviewCourse(null)}
        />
      )}

    </div>
  );
};
