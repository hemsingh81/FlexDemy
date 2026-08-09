export type SubjectCategory = 'computer_science' | 'stem_math' | 'physics' | 'data_science' | 'humanities';
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type ContentType = 'interactive' | 'video_text' | 'problem_based';

export interface Sentence {
  id: string;
  text: string;
  mathLaTeX?: string;
  hasDrilldown?: boolean;
  drilldownTopic?: string;
  diagramType?: 'pendulum' | 'neural_net' | 'circuit' | 'code_execution';
}

export interface ExampleItem {
  id: string;
  title: string;
  problem: string;
  mathLaTeX?: string;
  stepByStepSolution: string[];
  finalAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface DrillLevelData {
  level: number; // 1 to 5
  title: string; // e.g., "ELI5 / Intuitive Analogy", "Core Mechanics", etc.
  subtitle: string;
  content: string;
  keyPoints: string[];
  mathFormulas?: string[];
  examples: ExampleItem[];
}

export interface TopicDrilldown {
  topicKey: string;
  title: string;
  overview: string;
  levels: DrillLevelData[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  codeSnippet?: string;
  mathLaTeX?: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface TopicAssignment {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  fileUploadAllowed?: boolean;
  maxPoints: number;
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  sentences: Sentence[];
  drilldowns: Record<string, TopicDrilldown>; // Keyed by topicKey
  assignment?: TopicAssignment;
  isCompleted?: boolean;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface ScratchpadNote {
  id: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  paragraphIndex?: number;
  paragraphText?: string;
  moduleTitle?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  reviewText: string;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  subject: SubjectCategory;
  level: DifficultyLevel;
  type: ContentType;
  instructor: {
    name: string;
    role: string;
    avatar: string;
  };
  rating: number;
  enrolledCount: number;
  estimatedHours: number;
  thumbnail: string;
  badgeIcon: string;
  pricePerMinute?: number;
  flatCoursePrice?: number;
  targetGradeTag?: string; // e.g. "Class 10th", "Class 12th", "Undergrad", "PhD Level"
  tags?: string[]; // e.g. ["10th Class", "Physics", "Board Exam"]
  modules: Module[];
  prerequisites: string[];
}

export interface UserProgress {
  courseId: string;
  completedLessonIds: string[];
  lastLessonId: string;
  lastSentenceIndex: number;
  assignmentScores: Record<string, number>; // assignmentId -> score percentage
  timeSpentSeconds: number;
  enrolledDate: string;
  isCertificateEarned?: boolean;
  lastAccessedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'student' | 'instructor';
  streakDays: number;
  totalPoints: number;
  preferredVoice: string;
  ttsRate: number;
  ttsPitch: number;
  isDarkMode: boolean;
  language: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  progress: Record<string, UserProgress>; // courseId -> progress
  weeklyGoalHours?: number;
}

export interface StudyGroupRoom {
  id: string;
  name: string;
  courseTitle: string;
  hostName: string;
  activeCount: number;
  currentLessonTitle: string;
  currentSentenceText: string;
  isSyncPlaying: boolean;
  members: { name: string; avatar: string; isHost: boolean }[];
  chatMessages: { id: string; sender: string; text: string; timestamp: string; isSystem?: boolean }[];
  whiteboardElements: Array<{ id: string; type: 'draw' | 'text' | 'shape'; content: string; color: string; x: number; y: number }>;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  points: number;
  streakDays: number;
  weeklyHours: number;
  badge: string;
}

export interface TutorCalendarSlot {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM"
  endTime: string; // e.g. "11:00 AM"
  durationMinutes: number;
  isBooked: boolean;
  bookedByStudentId?: string;
  bookedByStudentName?: string;
  sessionType: 'one_on_one' | 'group' | 'public_class';
  ratePerMinute: number; // e.g. $1.50/min
  totalPrice?: number;
  topic?: string;
}

export interface GroupClassRequest {
  id: string;
  topic: string;
  courseTitle: string;
  requestedByStudentId: string;
  requestedByStudentName: string;
  studentPool: { studentId: string; studentName: string; avatar: string }[];
  status: 'pending' | 'scheduled' | 'completed';
  scheduledDate?: string;
  scheduledTime?: string;
  ratePerMinute: number;
  maxParticipants: number;
}

export interface PublicLiveClass {
  id: string;
  title: string;
  description: string;
  tutorName: string;
  tutorAvatar: string;
  tutorRole: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  pricePerMinute: number;
  flatPrice: number;
  subscribers: { studentId: string; studentName: string; avatar: string }[];
  status: 'upcoming' | 'live' | 'ended';
  meetingUrl?: string;
  subject: SubjectCategory;
  isSubscribedByMe?: boolean;
}

export interface CourseUploadAsset {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadDate: string;
  analysisStatus: 'uploaded' | 'analyzing' | 'completed';
  extractedChapters?: {
    chapterTitle: string;
    keyTopics: string[];
    generatedQuestionsCount: number;
  }[];
}

