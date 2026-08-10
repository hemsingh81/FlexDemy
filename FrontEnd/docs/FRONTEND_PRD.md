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
- **Top Navigation Bar**: Brand logo, active tab links (*Home, Dashboard, Group Study, Certificates*, plus Admin for permitted roles), language picker (English, Spanish, French, German, Chinese, Japanese), points counter, and student profile. The former standalone "Tutor Hub" and "Assignments" tabs are both retired — their content now lives inside the role-aware Dashboard, via its left-side section nav (§4.3, §4.8).
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

### 4.3. Dashboard (Role-Aware, merged with former Tutor Hub & Booking)
> **Superseded by a dedicated PRD.** This section (formerly "Dashboard & Weekly Goal Tracker") and the former §4.6 "Tutor Hub & Educator Dashboard" have been merged into a single role-aware Dashboard. Full requirements (FR-1 through FR-19), the Student/Tutor journeys, glossary, and rationale live in `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` — that document is the source of truth for this feature; this section is a summary pointer only.

- One "Dashboard" nav entry replaces the former separate "Dashboard" and "Tutor Hub & Booking" tabs, routed by the authenticated user's real role — no manual perspective toggle for Student/Tutor accounts (Master/Support get a narrow, admin-only preview toggle instead).
- **Student Dashboard**: Weekly Goal Card (SVG ring, 5-30hr target, goal-setter modal), Resume-Course banner, stat cards + 7-day activity calendar, Adaptive Schedule, My Courses (enrolled-only — grade/subject discovery filtering lives in the separate Course Discovery screen, `CourseDiscover.tsx`, undocumented elsewhere in this PRD, not here), plus the former Tutor Hub student content: browse/book 1-on-1 tutor slots, My Booked Sessions, Group Study Pool requests, Public Live Masterclass registration.
- **Tutor Dashboard**: Online/Offline toggle, earnings/hours/engagement bar chart, slot calendar management, Course Creation Wizard, public-class broadcast roster — carried over unchanged from the former Tutor Hub educator perspective.

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

### 4.6. Tutor Hub & Educator Dashboard — merged into §4.3
> This section has been merged into the Tutor Dashboard content of §4.3 above (the standalone "Tutor Hub" nav tab is retired). See §4.3 and `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md` for current requirements.

### 4.7. Synchronous Group Study Rooms
- **Live Peer Reader**: Synchronized sentence reader following the host's playback position.
- **Shared Collaborative Whiteboard**: Real-time note projection canvas with custom text and math formula placements.
- **Group Chat**: Instant peer-to-peer message stream.

### 4.8. Assignments (merged into Dashboard)
> **Superseded by a dedicated PRD.** The standalone "Assignments" nav tab is retired; Assignments is now a section of the role-aware Dashboard (§4.3), with a persistent submission/status model and a tutor-side create/score workflow that didn't exist before. Full requirements (FR-1 through FR-16), journeys, glossary, and rationale live in `_specs/planning-artifacts/prds/prd-eLearning-Assignments-2026-08-10/prd.md` — that document is the source of truth; this section is a summary pointer only.

- **Student**: Assignments section defaults to "My Submissions" (status: Submitted / Reviewed), plus a unified "Available Assignments" list spanning three sources — Course (existing lesson-embedded quizzes), Tutor (assigned directly by a tutor), and Competition (open, platform-wide). Taking an assignment still uses the existing multiple-choice quiz UI, instant explanation feedback, auto-calculated percentage, mastery points award (+150 pts), and celebratory confetti animation — all carried over unchanged for Course-source and Immediate-visibility items.
- **Tutor**: "My Assignments" (Draft / Published) with a creation flow — title, optional course link (or "Open / Competition" flag), multiple-choice questions with an answer key, and a Visibility Mode choice (show the auto-computed result to the student immediately, or hold it for tutor review before it's visible). A per-assignment Submissions view lets the tutor review held submissions and re-evaluate (manually override) already-reviewed scores.
- **File Upload**: The drag-and-drop file attachment field remains present but decorative/non-functional, as it was before this merge — not wired to any grading or persistence.

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
