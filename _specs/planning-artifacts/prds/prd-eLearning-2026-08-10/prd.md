---
title: Dashboard (Role-Aware Merge of Dashboard + Tutor Hub & Booking)
status: final
created: 2026-08-10
updated: 2026-08-10
---

# PRD: Dashboard (Role-Aware Merge of Dashboard + Tutor Hub & Booking)

## 0. Document Purpose

This PRD scopes the merge of two existing FlexDemy frontend surfaces — **Dashboard** and **Tutor Hub & Booking** — into a single, role-aware **Dashboard**. It is written for whoever builds and reviews the Phase B frontend work, and for keeping `FrontEnd/docs/BACKEND_PRD.md` in sync once the frontend flow is confirmed. It supersedes `FrontEnd/docs/FRONTEND_PRD.md` §4.3 ("Dashboard & Weekly Goal Tracker") and §4.6 ("Tutor Hub & Educator Dashboard"), which should be replaced by this document's §4 once approved. This is a **restructuring PRD**: almost every capability described here already exists in the product today (in `features/Dashboard/` and `features/TutorHub/`); the work is consolidating *where* it lives and *how* it's routed, not inventing new capability. Per the agreed execution plan: this PRD covers **Phase A**; **Phase B is frontend-only** (existing mock data services stay mocked); backend requirements are addressed afterward.

## 1. Vision

Today a Student and a Tutor open the app to two different, disconnected homes: Students land on **Dashboard** (progress, goals, courses) and have to switch to a separate **Tutor Hub** tab to book a session — a tab that also carries a manual "preview the other role" switch left over from early development. Tutors have the mirror problem: their teaching operations (availability, earnings, slots, course publishing) live in that same Tutor Hub tab, disconnected from the rest of the app.

The merged **Dashboard** becomes the single home surface for both roles. A Student opens Dashboard and gets their whole learning life — progress, goals, courses, *and* getting help from a tutor — in one place. A Tutor opens the same nav entry and gets their whole teaching operation in one place. Nobody sees a manual toggle or a feature that belongs to the other role; the app already knows who they are.

## 2. Target User

### 2.1 Jobs To Be Done

**Student** (`UserRole.Student`)
- When I open the app, I want one place to see my progress and pick up where I left off, so I don't have to hunt for it.
- When I need help, I want to find and book a tutor without leaving my main screen, so getting help feels like a natural next step, not a context switch.
- When I want to learn with peers, I want to see group study and masterclass options alongside my individual progress.

**Tutor** (`UserRole.Tutor`)
- When I open the app, I want one place to manage my teaching business — availability, bookings, earnings, and course content — so I'm not splitting attention across separate hubs.
- When a student books me, I want to see it reflected immediately where I already work, not in a tab I have to remember to check.

### 2.2 Non-Users (v1)

- **Unassigned, PendingTutor, RejectedTutor** roles — already intercepted before the main app shell (onboarding/approval pages) and never reach Dashboard. No change from current behavior; this PRD does not touch that gate.
- **Master / Support** are *not* non-users, despite appearing in this list historically — they have defined Dashboard behavior (§4.1 FR-3): default to the Student Dashboard, with an admin-only toggle to preview the Tutor Dashboard in an empty/demo state.

### 2.3 Key User Journeys

- **UJ-1. Priya opens Dashboard to keep learning and book help.**
  - **Persona + context:** Priya, a Student mid-way through several courses, opens the app on a weekday evening.
  - **Entry state:** Authenticated, Student role, lands on the single "Dashboard" nav tab (default landing surface).
  - **Path:** Sees her streak banner and taps "Resume Course." Glances at her stat cards and 7-day activity calendar, checks her Weekly Goal ring, reviews her Adaptive Schedule for the week. Scrolls to My Courses, opens one. Further down, browses available 1-on-1 tutor slots for a subject she's stuck on, filters by subject, and books a slot via the confirm modal. Checks her Group Study Pool options and requests one; browses Public Live Masterclasses and registers for one.
  - **Climax:** She has resumed a course *and* booked tutor help *and* joined a study group without ever leaving Dashboard or hunting for a separate tab.
  - **Resolution:** Confirmation toast for the booking; the session now appears under "My Booked Sessions" on the same page.
  - **Edge case:** If Priya has no booked sessions yet, "My Booked Sessions" shows an empty state, not an error.

- **UJ-2. Raj opens Dashboard to run his teaching day.**
  - **Persona + context:** Raj, an approved Tutor, opens the app at the start of his teaching day.
  - **Entry state:** Authenticated, Tutor role, lands on the same "Dashboard" nav tab — content is the Tutor Dashboard, not the Student Dashboard.
  - **Path:** Flips himself Online. Glances at his earnings/hours/engagement chart. Reviews his slot calendar — sees a new booking from a student with topic on hover — and adds a couple of open slots for the week. Opens the Course Creation Wizard and publishes a new course. Checks his public-class broadcast roster for an upcoming masterclass.
  - **Climax:** Raj has a full picture of his teaching business and has published new content, all from the same page a Student would land on.
  - **Resolution:** New slots are live and bookable by students immediately (via the existing mock service); the new course appears wherever published courses are listed.
  - **Edge case:** If Raj goes Offline, his slots remain visible in his own calendar but are not offered to students browsing available slots (existing behavior, carried over unchanged).

## 3. Glossary

- **Dashboard** — The single nav entry (was two: "Dashboard" and "Tutor Hub") that renders either the Student Dashboard or Tutor Dashboard based on the authenticated user's role.
- **Student Dashboard** — The role-specific view of Dashboard shown to `UserRole.Student`. Combines the former Dashboard content with the former Tutor Hub *student perspective* content.
- **Tutor Dashboard** — The role-specific view of Dashboard shown to `UserRole.Tutor`. Carries the full former Tutor Hub *educator perspective* content.
- **Tutor Slot** — A bookable (or booked) unit of a tutor's calendar for 1-on-1 sessions or a Public Live Masterclass. Created/edited by a Tutor, browsed/booked by a Student.
- **Booking** — A Student's confirmed reservation of a Tutor Slot.
- **Group Study Pool** — A request-to-form group learning arrangement among Students, distinct from a Synchronous Study Room (see below). Lives under Student Dashboard.
- **Public Live Masterclass** — A broadcast-style live class a Tutor publishes and Students browse/register for, managed via the broadcast roster on Tutor Dashboard. *[ASSUMPTION: term and capability are grounded in the actual codebase (types.ts's PublicLiveClass, groupStudyService.ts), not in FRONTEND_PRD.md — that doc doesn't mention "masterclass" anywhere; this PRD follows the code.]*
- **Synchronous Study Room** — The existing, separate real-time peer feature (live shared reader, whiteboard, chat) under the "Groups" nav tab. **Not** in scope for this merge; only its existing quick-join card on Student Dashboard is carried over unchanged. Do not conflate with Group Study Pool.
- **Weekly Goal** — A Student's self-set weekly study-hours target, tracked via the Weekly Goal Card.
- **Adaptive Schedule** — A Student's drag/drop weekly lesson planner.
- **Course Creation Wizard** — The 4-step flow a Tutor uses to publish a new course, carried over unchanged onto Tutor Dashboard.

## 4. Features

*Acceptance-criteria convention: FRs marked "carried over unchanged" that have no explicit Consequences block inherit byte-for-byte behavioral parity with the current implementation (per SM-1) as their acceptance criterion — check against the named source file/component, not just this FR's prose, before treating build-time ambiguity as license to redesign.*

### 4.1 Dashboard Shell & Role-Based Routing
**Description:** The structural change that makes the merge possible: one nav entry, content chosen by real role, no manual override for Student/Tutor accounts. Realizes UJ-1 and UJ-2 entry states. Role is read from the authenticated `UserProfile.role`, not any client-side preview state — with one narrow exception (FR-3) for Master/Support admin roles.

**Functional Requirements:**

#### FR-1: Single Dashboard nav entry
The system replaces the separate "Dashboard" and "Tutor Hub" nav tabs with one "Dashboard" entry.

**Consequences (testable):**
- The nav bar shows one entry where it previously showed two; no "Tutor Hub" label remains anywhere in the nav.
- Existing nav-tab visibility permissioning (`rolePermissions` / `DEFAULT_VISIBLE_TABS`) continues to gate the single "Dashboard" entry the same way it gated the old "dashboard" key.

#### FR-2: Role-driven content selection
The system renders the Student Dashboard for `UserRole.Student` and the Tutor Dashboard for `UserRole.Tutor` when the Dashboard nav entry is active.

**Consequences (testable):**
- A Student-role session never renders any Tutor Dashboard element (course wizard, slot calendar CRUD, earnings chart), and vice versa.
- No manual perspective/preview switch is presented to Student or Tutor roles anywhere in the merged Dashboard (see FR-3 for the narrower Master/Support exception).

**Out of Scope:**
- Dual-role or role-switching UX for Student/Tutor accounts (a single session showing both views) — not supported; see §5 Non-Goals.

#### FR-3: Master/Support tutor-view preview toggle
`UserRole.Master` and `UserRole.Support`, whose default Dashboard view is the Student Dashboard, additionally get a manual toggle — visible only to those two roles — to preview the Tutor Dashboard.

**Consequences (testable):**
- The toggle renders only for Master/Support sessions; Student and Tutor sessions never see it (preserves FR-2's role-purity guarantee for real Student/Tutor accounts).
- Toggling to Tutor view renders the full Tutor Dashboard UI (FR-15–FR-19) in an empty/demo state — no real slots, bookings, earnings, or course data, since Master/Support are not registered tutors.
- Toggling back returns to the default Student Dashboard.

**Out of Scope:**
- Impersonating a specific real Tutor account's live data — this toggle shows an empty/demo Tutor Dashboard only, not another user's actual data.

`[NOTE FOR PM]` This FR is a genuinely new admin-facing capability (no prior Master/Support Dashboard behavior existed to carry over), and the empty-demo-state design was a judgment call made collaboratively with the stakeholder rather than dictated by existing code — worth a second look if Master/Support usage patterns turn out to need real tutor-account visibility later (e.g. support troubleshooting a specific tutor's booking issue).

### 4.2 Student Dashboard — Learning & Progress
**Description:** Carried over unchanged from the current Dashboard. Realizes UJ-1 (beats 1–5).

**Functional Requirements:**

#### FR-4: Welcome banner & resume CTA
Student sees a welcome/streak banner with a "Resume Course" call-to-action pointing at their most recently active course.

**Consequences (testable):**
- `[ASSUMPTION: matches Dashboard.tsx's current banner exactly, including whatever course/lesson detail it already surfaces.]` The legacy spec (`FRONTEND_PRD.md` §4.3) additionally named "current lesson" and "progress percentage" as banner content and "Continue Learning" as the CTA label (this PRD uses "Resume Course"); the label change is intentional as part of this merge's copy pass, but the lesson/percentage detail should be verified against the live component during Phase B rather than assumed present or absent.

#### FR-5: Progress stat cards & activity calendar
Student sees stat cards (Day Streak, Enrolled Courses, Mastery Points, Time Spent) and a 7-day visual activity calendar.

#### FR-6: Weekly Goal Card
Student can view progress toward a weekly study-hours goal (SVG ring, target range 5–30 hours) and edit the target via a goal-setter modal, persisted via the existing goal service (`userService.ts`).

**Consequences (testable):**
- The goal-ring UI updates optimistically on save (no perceptible lag), even though persistence round-trips through the service layer rather than being purely client-local — preserves the legacy spec's "instant" UX guarantee without contradicting the actual service-backed mechanism.

#### FR-7: Adaptive Schedule
Student can view and drag/drop-edit a weekly lesson schedule.

#### FR-8: My Courses list
Student sees their *enrolled* courses with sort options (recently accessed / completion % / alphabetical) and per-course/per-module progress bars.

**Out of Scope:**
- Grade/subject filter pills, a search bar, and marketplace-style Course Card fields (rating, enrolled-count, instructor avatar) — verified against `Dashboard.tsx`: these do not exist in "My Courses" today. They live in the separate `CourseDiscover.tsx` component (the `discover` nav tab), which is unaffected by this merge. The legacy spec (`FRONTEND_PRD.md` §4.3) described this UI under a "Dashboard" heading, but it does not match where the capability actually lives in code; this PRD follows the code, not the stale doc. `[NOTE FOR PM]` `Dashboard.tsx` currently carries dead state (`selectedGradeTag`, `searchQuery`, `GRADE_TAGS`, `catalogCourses`/`recommendedCourses`) left over from that never-wired design — worth removing during Phase B build as incidental cleanup, not a scope item.

### 4.3 Student Dashboard — Tutor Booking & Group Learning
**Description:** Folded in from the former Tutor Hub student perspective. Realizes UJ-1 (beats 6–9).

**Functional Requirements:**

#### FR-9: Browse & filter tutor slots
Student can browse available 1-on-1 tutor slots and filter by subject/topic.

#### FR-10: Book a tutor slot
Student can book an available slot via a confirmation modal showing date/time/cost/notes.

**Consequences (testable):**
- On confirm, the slot moves from "available" to "booked" and appears in the student's "My Booked Sessions."
- Booking a slot that's no longer available (race with another student) surfaces an error, not a silent failure. `[ASSUMPTION: existing mock-service behavior carried over as-is; real concurrency handling is a backend-phase concern.]`

#### FR-11: My Booked Sessions
Student can view their upcoming/past booked sessions in table or card layout.

**Consequences (testable):**
- The existing 60-minute pre-session countdown toast (`ui/AppointmentToast.tsx`) is carried over unchanged — it remains rendered at the app-shell level (sharing `tutorSlots` state with the Dashboard's booking hook, as today), not moved into the Dashboard component itself.

#### FR-12: Group Study Pool requests
Student can request to form, or join, a Group Study Pool.

#### FR-13: Public Live Masterclass browsing & registration
Student can browse Public Live Masterclasses and register/subscribe.

#### FR-14: Study Rooms quick-join (unchanged)
Student's right rail retains the existing Synchronous Study Rooms quick-join card, which navigates to the separate "Groups" tab, and the Recent Activity feed.

**Consequences (testable):**
- The Recent Activity feed remains static/hardcoded for this frontend-only phase; wiring it to real data is confirmed for the backend phase (see §6.2, §9).

**Out of Scope:**
- Any change to the Synchronous Study Room feature itself (live reader, whiteboard, chat) — untouched, lives under "Groups."

### 4.4 Tutor Dashboard — Availability & Performance
**Description:** Folded in from the former Tutor Hub educator perspective. Realizes UJ-2 (beats 1–3).

**Functional Requirements:**

#### FR-15: Online/Offline toggle
Tutor can switch their live availability status.

**Consequences (testable):**
- When Offline, the tutor's slots are not offered to students browsing available slots (FR-9), consistent with current behavior.

#### FR-16: Performance analytics
Tutor sees a bar chart (Recharts) visualizing Monthly Earnings ($), Teaching Hours Logged, and Student Engagement Index. `[ASSUMPTION: "engagement index" calculation matches the existing implementation as-is; not redefined by this PRD.]`

#### FR-17: Slot calendar management
Tutor can view a grid of available/booked slots (hover shows student + topic) and create/edit 1-on-1 and Public Live Masterclass slots.

### 4.5 Tutor Dashboard — Course Publishing
**Description:** Folded in from the former Tutor Hub educator perspective. Realizes UJ-2 (beats 4–5).

**Functional Requirements:**

#### FR-18: Course Creation Wizard
Tutor can publish a new course via the existing 4-step wizard (grade tags, asset uploads, lesson modules).

#### FR-19: Public-class broadcast roster
Tutor can manage the roster/visibility of their own Public Live Masterclasses.

### 4.6 Cross-Cutting NFRs

- **Accessibility (carry-over):** The existing app-wide WCAG 2.1 AA support (`FRONTEND_PRD.md` §4.2 — high-contrast 7:1 mode, text sizing, screen-reader focus audio, keyboard shortcuts) is expected to apply unchanged to every newly composed Dashboard widget (Weekly Goal SVG ring, stat cards, slot calendar grid, wizard modal, analytics chart, etc.). This PRD does not redesign or re-verify accessibility per widget — it inherits the existing global commitment — but Phase B build/QA should confirm no widget regresses when relocated into the merged layout.
- **Test coverage (carry-over):** Relocated/composed components retain equivalent `vitest`/`@testing-library` coverage to what `features/Dashboard/` and `features/TutorHub/` have today (per architecture spine AD-5); tests move/merge with their components rather than being dropped.
- **No cross-role rendering cost:** A Student session must not mount, fetch, or bundle-load Tutor Dashboard widgets (and vice versa) merely because they now share one nav entry — role-based rendering should not regress initial load performance relative to today's separate tabs.

## 5. Non-Goals (Explicit)

- This PRD does not introduce any capability that doesn't already exist in `features/Dashboard/` or `features/TutorHub/` today — it is a consolidation, not a scope expansion.
- No backend/API work — data stays on existing mock services (`tutorService.ts`, `groupStudyService.ts`, `userService.ts`, `scheduleService.ts`) for Phase B. Backend requirements (including wiring Recent Activity to real data) are addressed in a follow-up pass to `BACKEND_PRD.md` that **reconciles with, and where the frontend flow now differs, supersedes** existing documented backend design for this surface — this is not a blank-slate authoring effort (see §9).
- No dual-role support for Student/Tutor accounts — a Student or Tutor session shows exactly one dashboard, never both, and never a manual switch between them. (Master/Support are the sole, narrower exception — FR-3.)
- No change to the Synchronous Study Room ("Groups" tab) feature itself.
- No redesign of individual widgets' visuals/interactions beyond what's needed to compose them into one page — this is a structural/routing merge, not a visual refresh. `[NON-GOAL for MVP: a shared visual pass across both role dashboards is worth doing later but isn't required to ship this merge.]`

## 6. MVP Scope

### 6.1 In Scope
- Retiring the separate "Tutor Hub" nav tab and the old general-purpose manual perspective toggle.
- One "Dashboard" nav entry, role-routed per FR-1/FR-2, with the narrower Master/Support preview toggle per FR-3.
- All FRs in §4.2–§4.5, relocated/composed under the merged Dashboard, frontend-only.
- Updating `FrontEnd/docs/FRONTEND_PRD.md` to reflect the merged structure (superseding old §4.3/§4.6).

### 6.2 Out of Scope for MVP
- Backend API design for booking/slots/courses/Recent-Activity data (deferred; `BACKEND_PRD.md` §3.5/§4.4 already documents a `tutor_slots` table and booking/slot/analytics endpoints, and `ARCHITECTURE-SPINE.md` reserves a `Tutoring` feature slice for it — none of it implemented in code yet. The follow-up backend pass reconciles/updates that existing design against the current frontend flow and the actual `User`/`Course` entities — see §9 — rather than starting from nothing. Recent Activity wiring is confirmed in-scope for that backend phase, not indefinitely deferred. Group Study Pool and Public Live Masterclass genuinely have no prior backend documentation and will be net-new there.)

## 7. Success Metrics

**Primary**
- **SM-1**: Feature parity — every FR in §4.2–§4.5 is reachable and functional from the single Dashboard entry post-merge, with zero regressions against current behavior. Validated via a manual pass + updated test suite. Validates FR-1 through FR-19.

**Secondary**
- **SM-2**: Nav simplified from 7 top-level tabs to 6 (Tutor Hub removed) with no loss of discoverability — validated by confirming every prior Tutor Hub action has an equivalent reachable path on the merged Dashboard. *(7/6 counted from the live `DEFAULT_VISIBLE_TABS`/`App.tsx` nav config — dashboard, discover, tutor, groups, assignments, certificates, admin — which is authoritative; `FRONTEND_PRD.md` §4.1's nav description is stale and lists only 5, predating the current tab set.)*

**Counter-metrics (do not optimize)**
- **SM-C1**: Role purity — do not "simplify" by showing any Tutor-only or Student-only widget to the wrong Student/Tutor role just to reduce branching complexity in the code. Counterbalances SM-2.

## 8. Open Questions

None outstanding as of this review round — see §9 for the resolutions folded into this draft.

## 9. Assumptions Index

*This index doubles as a decision log for this restructuring PRD, not purely open/unresolved assumptions — most entries below are resolved decisions, tagged with how they were reached.*

- §2.1/§4.1 — Role is read from the authenticated `UserProfile.role`; no client-side preview/toggle state for Student/Tutor accounts. *(Confirmed with stakeholder during Discovery.)*
- §2.2/§4.1 FR-3 — Master/Support default to the Student Dashboard with an admin-only toggle to an empty/demo Tutor Dashboard (no real tutor data, no impersonation of a specific real tutor). *(Resolved with stakeholder in this review round — see `[NOTE FOR PM]` at FR-3.)*
- §4.3 FR-10 — Booking race-condition handling stays on existing mock-service behavior; real concurrency handling deferred to backend phase.
- §5/§6.2 — `BACKEND_PRD.md` §3.5/§4.4 already documents a `tutor_slots` table and booking/slot/analytics/course-creation endpoints, and `ARCHITECTURE-SPINE.md` (2026-08-09) already reserves a `Tutoring` feature slice (`TutorSlot` entity, `ITutorService`, `TutorController`) derived from it — **no C# implementation exists yet, but documented design intent does.** `[NOTE FOR PM]` The follow-up backend PRD must reconcile/supersede that existing design (not author from a blank slate), and must reconcile `BACKEND_PRD.md`'s `users` table dashboard fields (`streak_days`, `total_points`, `weekly_goal_hours`) against the actual `User.cs` entity, which has none of them — that data model is itself stale. Group Study Pool and Public Live Masterclass have zero prior backend documentation and are genuinely net-new there. *(Corrected during Finalize input-reconciliation against `BACKEND_PRD.md`; the initial draft's "authored fresh" framing was inaccurate and is superseded by this entry. Backend-ownership call otherwise per stakeholder's "decide yourself.")*
- §4.3 FR-14 — Recent Activity feed stays static/hardcoded for the frontend-only phase; wiring to real data is confirmed in-scope for the backend phase. *(Confirmed with stakeholder in this review round.)*
- §3 Glossary — "Public Live Masterclass" terminology is grounded in the actual codebase (`types.ts`), not in `FRONTEND_PRD.md`, which never uses that term. *(Surfaced during Finalize input-reconciliation.)*
- §4.2 FR-4 — Whether the resume-course banner surfaces current-lesson name and progress percentage (as the legacy spec described) or only the course-level CTA is unverified against the live component; treated as unconfirmed pending Phase B build-time check. *(Surfaced during Finalize input-reconciliation.)*
