# Backend Product Requirement Document (PRD) - LearnSphere API & Microservices Architecture

## 1. Executive Summary
This document specifies the backend service architecture, relational database schema, REST API endpoints, WebSocket real-time event protocols, and AI microservice integrations required to support the LearnSphere learning platform, including TTS voice settings, weekly study goal persistence, and full course overview data aggregation.

---

## 2. Backend System Architecture
- **Primary API Server**: Express / Node.js or FastAPI (Python), exposed via REST and WebSockets.
- **Database**: PostgreSQL (Relational) or Firestore with indexing for full-text search and tag filtering.
- **Caching & Real-Time Message Broker**: Redis for WebSocket session state, active study room synchronization, and session countdown notifications.
- **AI Integration Pipeline**: Gemini 2.5 API integration for dynamic 5-level concept expansion, automated quiz generation, and essay evaluation.

---

## 3. Database Schema Specification

### 3.1. `users` Table
```sql
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    role VARCHAR(32) DEFAULT 'student', -- 'student', 'tutor', 'admin'
    streak_days INT DEFAULT 0,
    total_points INT DEFAULT 0,
    preferred_voice VARCHAR(255) DEFAULT '',
    tts_rate NUMERIC(3,2) DEFAULT 1.0,
    tts_pitch NUMERIC(3,2) DEFAULT 1.0,
    weekly_goal_hours INT DEFAULT 10,
    preferred_language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2. `courses` Table
```sql
CREATE TABLE courses (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    short_description TEXT,
    full_description TEXT,
    subject VARCHAR(64) NOT NULL, -- 'physics', 'computer_science', 'stem_math'
    level VARCHAR(32) NOT NULL, -- 'Beginner', 'Intermediate', 'Advanced'
    target_grade_tag VARCHAR(64) NOT NULL, -- e.g., 'Class 10th', 'Class 12th', 'Undergrad'
    tags TEXT[], -- Array of strings e.g. ['Physics', 'Electricity', 'Board Exam']
    instructor_name VARCHAR(255) NOT NULL,
    instructor_role VARCHAR(255),
    instructor_avatar TEXT,
    rating NUMERIC(3,2) DEFAULT 5.0,
    enrolled_count INT DEFAULT 0,
    estimated_hours INT DEFAULT 1,
    thumbnail_url TEXT,
    badge_icon VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3. `course_notes` Table
```sql
CREATE TABLE course_notes (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) REFERENCES courses(id),
    user_id VARCHAR(64) REFERENCES users(id),
    lesson_id VARCHAR(64),
    lesson_title VARCHAR(255),
    paragraph_index INT DEFAULT 0,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.4. `course_reviews` Table
```sql
CREATE TABLE course_reviews (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) REFERENCES courses(id),
    user_id VARCHAR(64) REFERENCES users(id),
    user_name VARCHAR(255) NOT NULL,
    user_avatar TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3.5. `tutor_slots` Table
```sql
CREATE TABLE tutor_slots (
    id VARCHAR(64) PRIMARY KEY,
    tutor_id VARCHAR(64) REFERENCES users(id),
    tutor_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    booked_by_student_id VARCHAR(64) REFERENCES users(id),
    rate_per_minute NUMERIC(6,2) NOT NULL,
    topic VARCHAR(255),
    status VARCHAR(32) DEFAULT 'available' -- 'available', 'booked', 'completed'
);
```

---

## 4. REST API Endpoint Specification

### 4.1. Courses & Overview Data Aggregation
- **`GET /api/v1/courses`**
  - Query Params: `gradeTag` (e.g., `Class 10th`), `search` (text query), `subject`
  - Response: `Array<Course>` matching grade and tag filters.
- **`GET /api/v1/courses/:id/overview`**
  - Aggregates course details, full module syllabus, user progress, attached study notes, and student reviews for the 100% full-width overview screen.
- **`POST /api/v1/courses`** (Tutor Only)
  - Body: Course creation payload with modules, lessons, target grade tags, and asset attachments.

### 4.2. User Voice & Goal Settings
- **`PATCH /api/v1/user/settings`**
  - Body: `{ preferredVoice, ttsRate, ttsPitch, weeklyGoalHours, preferredLanguage }`
  - Updates student profile settings.

### 4.3. Notes & Reviews
- **`POST /api/v1/courses/:id/notes`**
  - Body: `{ lessonId, lessonTitle, content }`
- **`POST /api/v1/courses/:id/reviews`**
  - Body: `{ rating, reviewText }`

### 4.4. Tutor Hub & Slot Management
- **`GET /api/v1/tutor/slots`**
  - Returns upcoming available and booked slots.
- **`POST /api/v1/tutor/book-slot`**
  - Body: `{ slotId, studentId }`
- **`PATCH /api/v1/tutor/status`**
  - Body: `{ isOnline: boolean }`
- **`GET /api/v1/tutor/analytics`**
  - Returns aggregated earnings, hours taught, and monthly engagement stats for Recharts rendering.

---

## 5. Real-Time WebSocket Protocols (`/ws`)

### 5.1. Session Countdown Toast Notification (`/ws/notifications`)
- **Event**: `SESSION_COUNTDOWN_WARNING`
  - Triggered automatically when `now() - slot.startTime <= 60 minutes`.
  - Payload: `{ slotId, tutorName, topic, minutesRemaining: 45 }`

### 5.2. Synchronous Study Room (`/ws/study-room/{roomId}`)
- **Event**: `SYNC_READER_TICK` -> Broadcasts current sentence index to all peers in the room.
- **Event**: `WHITEBOARD_NOTE_PROJECT` -> Broadcasts new whiteboard note or math formula element `{ content, x, y, color }`.
- **Event**: `CHAT_MESSAGE` -> Broadcasts instant chat messages.

---

## 6. AI Microservice Pipeline
- **Dynamic 5-Level Concept Drilldown Service**:
  - Request: `{ topicKey, depthLevel (1-5), userGrade }`
  - Gemini Prompt Pipeline generates age-appropriate analogy (L1), formulas (L2-L3), and research papers (L5).
- **Auto-Grading & Rubric Analysis Service**:
  - Evaluates uploaded student code or essay files against solution rubrics.

---

## 7. Security & Deployment Architecture
- **Authentication**: JWT token bearer authorization with OAuth2.0 integration (Google / Workspace).
- **Rate Limiting**: Redis-backed leaky bucket rate limiter.
- **Deployment**: Scalable Cloud Run / Docker container instances behind an NGINX reverse proxy on port 3000.
