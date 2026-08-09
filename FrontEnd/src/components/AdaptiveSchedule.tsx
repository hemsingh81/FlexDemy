import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, CheckCircle2, Clock, Sparkles, BookOpen, Layers, GripVertical, Award } from 'lucide-react';
import { Course, Lesson } from '../types';

export interface ScheduledLessonItem {
  id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  durationMinutes: number;
  completed: boolean;
}

interface AdaptiveScheduleProps {
  courses: Course[];
  weeklyGoalHours: number;
  onOpenCourse: (courseId: string, lessonId?: string) => void;
}

const SCHEDULE_STORAGE_KEY = 'learnsphere_adaptive_schedule_v1';

const DAYS_OF_WEEK: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export const AdaptiveSchedule: React.FC<AdaptiveScheduleProps> = ({
  courses,
  weeklyGoalHours,
  onOpenCourse,
}) => {
  const [scheduledItems, setScheduledItems] = useState<ScheduledLessonItem[]>([]);
  const [selectedDayToAdd, setSelectedDayToAdd] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>('Mon');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [draggedLesson, setDraggedLesson] = useState<{ courseId: string; lessonId: string; title: string; duration: number; courseTitle: string } | null>(null);

  // Load stored schedule or seed defaults
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (raw) {
        setScheduledItems(JSON.parse(raw));
      } else if (courses.length > 0) {
        // Seed default schedule items for demonstration
        const c1 = courses[0];
        const l1 = c1?.modules[0]?.lessons[0];
        const l2 = c1?.modules[0]?.lessons[1] || l1;

        const seeded: ScheduledLessonItem[] = [
          {
            id: 'sch_1',
            day: 'Mon',
            courseId: c1.id,
            courseTitle: c1.title,
            lessonId: l1?.id || 'l1',
            lessonTitle: l1?.title || 'Key Concepts',
            durationMinutes: l1?.durationMinutes || 25,
            completed: true,
          },
          {
            id: 'sch_2',
            day: 'Wed',
            courseId: c1.id,
            courseTitle: c1.title,
            lessonId: l2?.id || 'l2',
            lessonTitle: l2?.title || 'Advanced Principles',
            durationMinutes: l2?.durationMinutes || 30,
            completed: false,
          },
        ];
        setScheduledItems(seeded);
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(seeded));
      }
    } catch (e) {
      console.error(e);
    }
  }, [courses]);

  // Persist items
  const updateAndSaveSchedule = (items: ScheduledLessonItem[]) => {
    setScheduledItems(items);
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate total scheduled minutes & completed minutes
  const totalScheduledMinutes = scheduledItems.reduce((sum, item) => sum + item.durationMinutes, 0);
  const completedScheduledMinutes = scheduledItems
    .filter((item) => item.completed)
    .reduce((sum, item) => sum + item.durationMinutes, 0);

  const totalScheduledHours = (totalScheduledMinutes / 60).toFixed(1);
  const completedScheduledHours = (completedScheduledMinutes / 60).toFixed(1);
  const goalPercent = Math.min(100, Math.round(((totalScheduledMinutes / 60) / weeklyGoalHours) * 100));

  // Add lesson to schedule
  const handleAddLessonToSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedLessonId) return;

    const course = courses.find((c) => c.id === selectedCourseId);
    const allLessons = course?.modules.flatMap((m) => m.lessons) || [];
    const lesson = allLessons.find((l) => l.id === selectedLessonId);

    if (course && lesson) {
      const newItem: ScheduledLessonItem = {
        id: `sch_${Date.now()}`,
        day: selectedDayToAdd,
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        durationMinutes: lesson.durationMinutes || 20,
        completed: false,
      };

      updateAndSaveSchedule([...scheduledItems, newItem]);
      setIsAddModalOpen(false);
      setSelectedLessonId('');
    }
  };

  const handleToggleCompleted = (id: string) => {
    const updated = scheduledItems.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    updateAndSaveSchedule(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = scheduledItems.filter((item) => item.id !== id);
    updateAndSaveSchedule(updated);
  };

  // HTML5 Drag & Drop handlers
  const handleDropOnDay = (day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun') => {
    if (!draggedLesson) return;

    const newItem: ScheduledLessonItem = {
      id: `sch_${Date.now()}`,
      day: day,
      courseId: draggedLesson.courseId,
      courseTitle: draggedLesson.courseTitle,
      lessonId: draggedLesson.lessonId,
      lessonTitle: draggedLesson.title,
      durationMinutes: draggedLesson.duration,
      completed: false,
    };

    updateAndSaveSchedule([...scheduledItems, newItem]);
    setDraggedLesson(null);
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-[#E1DED4] p-6 sm:p-8 shadow-xs space-y-6">
      
      {/* Header & Goal Synchronization Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E1DED4] pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#EC7B38]">
            <Calendar className="w-5 h-5" />
            <h3 className="text-xl font-bold font-display text-[#142030]">Adaptive Study Schedule</h3>
          </div>
          <p className="text-xs text-[#5E6A79]">
            Drag & drop course lessons to structure your weekly calendar. Synchronizes directly with your Weekly Study Goal.
          </p>
        </div>

        {/* Goal Sync Progress Card */}
        <div className="p-4 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] flex items-center space-x-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#142030] gap-3">
              <span>Weekly Plan: {totalScheduledHours} / {weeklyGoalHours} hrs</span>
              <span className="text-[#179765]">{goalPercent}% Goal Met</span>
            </div>

            <div className="w-48 h-2.5 bg-white rounded-full overflow-hidden border border-[#E1DED4]">
              <div
                className="h-full bg-[#179765] rounded-full transition-all duration-300"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            
            <p className="text-[10px] text-[#5E6A79]">
              {completedScheduledHours} hrs completed of planned schedule
            </p>
          </div>

          <button
            onClick={() => {
              if (courses.length > 0) {
                setSelectedCourseId(courses[0].id);
                const firstLesson = courses[0].modules[0]?.lessons[0];
                if (firstLesson) setSelectedLessonId(firstLesson.id);
              }
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 text-[#EC7B38]" />
            <span>Schedule Lesson</span>
          </button>
        </div>
      </div>

      {/* Quick Drag Library Bar */}
      <div className="p-4 rounded-2xl bg-[#FAF7EC]/70 border border-[#E1DED4] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#142030] flex items-center space-x-1.5">
            <GripVertical className="w-4 h-4 text-[#EC7B38]" />
            <span>Drag & Drop Lesson Deck (Drag onto any day below):</span>
          </span>
          <span className="text-[10px] text-[#5E6A79] font-medium">
            💡 Or click + on any day column
          </span>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-1">
          {courses.flatMap((c) =>
            c.modules.flatMap((m) =>
              m.lessons.map((l) => ({
                courseId: c.id,
                courseTitle: c.title,
                lessonId: l.id,
                title: l.title,
                duration: l.durationMinutes,
              }))
            )
          ).slice(0, 6).map((item) => (
            <div
              key={`${item.courseId}_${item.lessonId}`}
              draggable
              onDragStart={() => setDraggedLesson(item)}
              className="px-3 py-2 bg-white hover:bg-[#143358] hover:text-white rounded-xl border border-[#E1DED4] text-xs font-bold text-[#142030] flex items-center space-x-2 cursor-grab active:cursor-grabbing transition-all shrink-0 shadow-2xs group"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#EC7B38]" />
              <span className="truncate max-w-[140px]">{item.title}</span>
              <span className="px-1.5 py-0.5 rounded bg-[#FAF7EC] group-hover:bg-white/20 text-[10px] text-[#5E6A79] group-hover:text-white">
                {item.duration}m
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 7-DAY CALENDAR GRID - 100% Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DAYS_OF_WEEK.map((day) => {
          const dayItems = scheduledItems.filter((i) => i.day === day);
          const dayMinutes = dayItems.reduce((acc, i) => acc + i.durationMinutes, 0);

          return (
            <div
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnDay(day)}
              className="p-3.5 bg-[#FAF7EC]/50 rounded-2xl border border-[#E1DED4] hover:border-[#143358] transition-all flex flex-col justify-between min-h-[200px]"
            >
              <div className="space-y-3">
                {/* Day Header */}
                <div className="flex items-center justify-between border-b border-[#E1DED4] pb-2">
                  <span className="text-xs font-extrabold text-[#143358] uppercase tracking-wider">{day}</span>
                  <span className="text-[10px] font-bold text-[#5E6A79] px-1.5 py-0.5 bg-white rounded-full border border-[#E1DED4]">
                    {dayMinutes}m
                  </span>
                </div>

                {/* Scheduled Items in Day */}
                <div className="space-y-2">
                  {dayItems.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-[#E1DED4] rounded-xl">
                      <p className="text-[10px] text-[#5E6A79]">Drop lesson here</p>
                    </div>
                  ) : (
                    dayItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border text-xs transition-all space-y-1 relative group ${
                          item.completed
                            ? 'bg-[#179765]/10 border-[#179765]/30 text-[#179765]'
                            : 'bg-white border-[#E1DED4] text-[#142030] hover:border-[#EC7B38]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <button
                            onClick={() => onOpenCourse(item.courseId, item.lessonId)}
                            className="font-bold text-left hover:underline line-clamp-2 transition-all cursor-pointer"
                          >
                            {item.lessonTitle}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 transition-opacity cursor-pointer shrink-0"
                            title="Remove from schedule"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="flex items-center space-x-1 text-[#5E6A79]">
                            <Clock className="w-3 h-3" />
                            <span>{item.durationMinutes} mins</span>
                          </span>

                          <button
                            onClick={() => handleToggleCompleted(item.id)}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              item.completed
                                ? 'bg-[#179765] text-white'
                                : 'bg-slate-100 text-slate-400 hover:text-[#179765]'
                            }`}
                            title={item.completed ? 'Mark as Incomplete' : 'Mark Completed'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Button for Specific Day */}
              <button
                onClick={() => {
                  setSelectedDayToAdd(day);
                  if (courses.length > 0) {
                    setSelectedCourseId(courses[0].id);
                    const firstLesson = courses[0].modules[0]?.lessons[0];
                    if (firstLesson) setSelectedLessonId(firstLesson.id);
                  }
                  setIsAddModalOpen(true);
                }}
                className="w-full mt-3 py-1.5 bg-white hover:bg-[#143358] hover:text-white text-[#142030] border border-[#E1DED4] rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <Plus className="w-3 h-3 text-[#EC7B38]" />
                <span>Add</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Schedule Lesson Modal Window */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-300 ease-in-out">
          <div className="bg-white border border-[#E1DED4] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fade-in transition-all duration-300">
            <div className="flex items-center justify-between border-b border-[#E1DED4] pb-3">
              <h3 className="text-base font-bold text-[#142030] font-display flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[#EC7B38]" />
                <span>Schedule Lesson on {selectedDayToAdd}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLessonToSchedule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#142030]">Select Day of Week</label>
                <select
                  value={selectedDayToAdd}
                  onChange={(e) => setSelectedDayToAdd(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs font-bold text-[#142030]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#142030]">Select Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    const course = courses.find((c) => c.id === e.target.value);
                    const firstLesson = course?.modules[0]?.lessons[0];
                    if (firstLesson) setSelectedLessonId(firstLesson.id);
                  }}
                  className="w-full p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs font-bold text-[#142030]"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#142030]">Select Lesson Module</label>
                <select
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#FAF7EC] border border-[#E1DED4] text-xs font-bold text-[#142030]"
                >
                  {courses
                    .find((c) => c.id === selectedCourseId)
                    ?.modules.flatMap((m) => m.lessons)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} ({l.durationMinutes} mins)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#142030] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Save to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
