# Frontend Product Requirement Document (PRD) - FlexDemy

## 1. Executive Summary
FlexDemy is a full-width, high-density AI-powered educational web application designed for interactive learning, synchronous peer study rooms, 5-level topic drilldowns, a comprehensive Course Overview & Preview system, and an interactive Tutor Hub. The frontend is built using React 18, TypeScript, Tailwind CSS, Recharts, and Web Speech API, optimized for responsive displays ranging from mobile devices to ultra-wide 4K monitors.

---

## 2. Target Audience & Personas
- **Students (e.g., Class 10th, 12th, Undergrad, PhD)**: Learners seeking intuitive explanations, grade-specific course discovery (e.g., "Class 10th Physics"), audio-assisted auto-scroll reading with custom voice settings, weekly goal tracking, and peer study groups.
- **Tutors / Instructors**: Educators managing appointment slots, hosting public masterclasses, reviewing analytics (earnings, teaching hours, engagement), toggling online/offline availability, and publishing courses via a multi-step Course Creation Wizard.

---

## 3. Key UI Architecture & Design System Rules
- **Layout**: 100% full-width container across all views (`w-full`), ensuring content seamlessly scales on large widescreen monitors without forced max-width clipping.
- **Visual Theme**: Crisp, high-contrast light theme with neutral cream/slate backgrounds (`bg-slate-50`, `bg-[#FAF7EC]`), soft rounded cards (`rounded-2xl`, `rounded-3xl`), and indigo/amber accent highlights.
- **Typography**: Clean hierarchy with bold display headings (Playfair Display / Plus Jakarta) and legible body copy.

---

## 4. Core Modules & Feature Specifications

### 4.1. Navigation & Header
- **Top Navigation Bar**: Brand logo, active tab links (*Dashboard, Tutor Hub, Group Study, Assignments, Certificates*), language picker (English, Spanish, French, German, Chinese, Japanese), points counter, and student profile.
- **Accessibility Trigger**: Header button opening the WCAG 2.1 Accessibility & Voice Settings Modal.
- **Notice & Toast Notifications**: Real-time toast alert banner triggering countdown timers when a booked tutor session starts within 60 minutes.

### 4.2. WCAG 2.1 Accessibility & Voice Settings Modal
- **Voice & Narration Settings (TTS)**:
  - **TTS Voice Selector**: System voice selection dropdown populated dynamically via `ttsManager.getAvailableVoices()`.
  - **Speech Speed Rate Controls**: Speed multiplier buttons (0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
  - **Narration Pitch Controls**: Pitch depth selector (Deep / Low 0.8, Natural / Standard 1.0, High / Crisp 1.2).
  - **Interactive Voice Preview**: "Test Voice Preview" button allowing users to hear their selected voice, speed, and pitch in real-time before applying.
- **Visual Accessibility Options**:
  - **High Contrast Mode**: 7:1 contrast ratio toggle for low-vision learners.
  - **Reader Text Sizing**: Text size adjusters (14px, 16px, 18px, 20px).
  - **Screen Reader Focus Audio**: Auto-speak text when keyboard navigating with Tab key.
  - **Keyboard Shortcuts Cheatsheet**: Quick reference for Space (Play/Pause), Arrow keys (Skip), and Esc (Close).

### 4.3. Dashboard & Weekly Goal Tracker
- **Weekly Goal Card**:
  - Circular SVG progress ring displaying hours logged vs. weekly goal target.
  - Goal Setter Modal allowing users to adjust weekly study target (e.g. 5 - 30 hours) with instant local state persistence.
- **Quick Continue Banner**: Displays active course, current lesson, and progress percentage with instant "Continue Learning" trigger.
- **Grade & Tag Strict Filtering**:
  - Filter pills for target grades: *All, Class 10th, Class 12th, Undergrad, PhD Level*.
  - Search bar filtering by course title, subject tags (e.g., "Physics", "Calculus"), or description.
- **Course Card**: Thumbnail image, instructor avatar, grade tag badge, rating, enrolled count, and "Course Overview" button.

### 4.4. Course Overview & Preview Screen (100% Full-Width)
- **100% Full-Width Layout**: Scaled across `w-full px-4 sm:px-8 lg:px-12` for widescreen immersion.
- **Sticky Top Scroll Navigation Bar**:
  - Sticky sub-menu with direct smooth-scroll anchor jump links:
    - `1. Chapters & Lessons` (`#section-chapters`)
    - `2. Overall Progress` (`#section-progress`)
    - `3. Attached Study Notes` (`#section-notes`)
    - `4. Student Reviews` (`#section-reviews`)
- **Sequential Information Display**: All course details are rendered sequentially on one page:
  - **1. Course Syllabus**: Modules, lesson duration, assignment badges, and instant lesson launcher.
  - **2. Detailed Progress**: Completion metrics, time spent reading, enrolled date, and module percentage bars.
  - **3. Attached Study Notes**: Personal scratchpad notes form & note card list.
  - **4. Student Reviews & Comments**: Verified peer feedback list and "Write Course Review" modal trigger.

### 4.5. Interactive Course Player & 5-Level Deep Drilldown Engine
- **Audio TTS Reader Bar**: Auto-scroll sentence reader powered by user's voice settings (voice, rate, pitch).
- **Interactive Sentence Navigation**: Sentence-by-sentence highlight during playback with keyboard controls.
- **5-Level Deep Concept Drilldown Engine**:
  - *Level 1*: ELI5 / Intuitive Analogy
  - *Level 2*: Core Physical & Mathematical Principles
  - *Level 3*: Formal Vector / Matrix Derivations
  - *Level 4*: Real-World Algorithms & Applications
  - *Level 5*: Advanced Research Frontiers & Noise Limits
  - Step-by-step example problem accordion and LaTeX math formula rendering.

### 4.6. Tutor Hub & Educator Dashboard
- **Online / Offline Status Toggle**: Live availability switcher updating tutor state in real-time.
- **Quick Book Calendar & Slots**:
  - Interactive grid showing available vs. booked slots.
  - Hover tooltip displaying slot details, student name, and topic.
- **Recharts Analytics Engine**: Bar chart visualization for Monthly Earnings ($), Teaching Hours Logged, and Student Engagement Index.
- **Course Creation Wizard Modal**: Multi-step wizard form for publishing new courses with grade tags, asset uploads, and lesson modules.

### 4.7. Synchronous Group Study Rooms
- **Live Peer Reader**: Synchronized sentence reader following the host's playback position.
- **Shared Collaborative Whiteboard**: Real-time note projection canvas with custom text and math formula placements.
- **Group Chat**: Instant peer-to-peer message stream.

### 4.8. Assignments & Auto-Grading Engine
- **Multiple-Choice Quizzes**: Interactive option picker with instant explanation feedback upon submission.
- **File Upload**: Drag-and-drop file attachment for code scripts (.py, .js) or essay PDFs.
- **Grading Report**: Auto-calculated percentage, mastery points award (+150 pts), and celebratory confetti animations.

### 4.9. Certificates & Leaderboard
- **Verified Certificate Canvas**: Real-time certificate generator with PDF export trigger.
- **Global Leaderboard**: Weekly rank list showing total points, streak days, and custom badges.

---

## 5. Technical Requirements & Dependencies
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Speech Synthesis**: Web Speech API (`speechSynthesis` / `SpeechSynthesisUtterance`) via `ttsManager`
- **Icons**: `lucide-react`
- **Charts**: `recharts`
- **Animations**: `canvas-confetti`

---

## 6. Frontend State Management
- `UserProfile`: Student points, preferredVoice, ttsRate, ttsPitch, enrolled progress, language preference, dark/light toggle.
- `Course[]`: Course list with modules, lessons, `targetGradeTag`, and `tags`.
- `TutorSlot[]`: Availability slots and booking status.
- `StudyGroupRoom[]`: Synchronous rooms, chat messages, and whiteboard elements.
