---
title: FlexDemy Experience Spec
status: final
created: 2026-08-10
updated: 2026-08-10
name: FlexDemy
sources:
  - {planning_artifacts}/prds/prd-eLearning-2026-08-10/prd.md
  - {planning_artifacts}/prds/prd-eLearning-Assignments-2026-08-10/prd.md
---

# FlexDemy — Experience Spine

## Foundation

Single-surface responsive web (React 19 + TypeScript + Vite, Tailwind v4). No native mobile app. `DESIGN.md` is the visual identity reference; this spine is the experience. Navigation is client-side tab state (no router) — `activeTab` in `App.tsx`, with a crossfade transition between tabs, not a hard unmount/mount swap.

Two structurally different populations share the same shell: **Student** and **Tutor**, gated by real authenticated role, not a manual toggle. Onboarding funnel roles (`Unassigned`, `PendingTutor`, `RejectedTutor`) are intercepted before the main shell and see dedicated single-purpose pages instead. **Master/Support** (admin) roles default to the Student experience with a narrow, admin-only toggle to preview an empty/demo Tutor Dashboard.

**Hard constraint, not a preference:** every surface is full-width (no `max-w-*` content column, ever) and responsive (no surface may silently lose functionality on a narrower viewport — every breakpoint-gated element needs a same-capability equivalent below the breakpoint). See `DESIGN.md.Layout & Spacing` for the visual rule and Responsive & Platform below for the behavioral rule.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Home (Discover) | Default landing tab, logo click | Course catalog browse/search/filter — grade, subject, difficulty |
| Dashboard | Top nav | Role-routed single home. Student: Weekly Goal → Adaptive Schedule → My Courses → Assignments → Tutor Booking & Group Learning. Tutor: Availability & Performance → Assignments → Course Publishing. Left-side section nav on both (see Responsive & Platform). |
| Course Overview | Course card ("Course Overview") | Full detail on one course: syllabus, progress, notes, reviews. Sticky top scroll-jump sub-nav (existing pattern, distinct from Dashboard's left nav). Its syllabus shows a separate per-lesson "assignment badge" — a different, unreconciled surface from the Dashboard's Assignments Source badges; the two are not yet unified (deferred per the Assignments PRD). |
| Course Player | "Start/Resume/Continue Learning," or a lesson's "Take Quiz" (→ Dashboard Assignments) | Interactive lesson reader with 5-level concept drilldown and audio narration. |
| Group Study | Top nav | Synchronous peer study rooms — live shared reader, whiteboard, chat. Distinct from Dashboard's Group Study *Pool* requests (async matchmaking, not live sessions). |
| Certificates | Top nav | Earned certificates + leaderboard. |
| Admin | Top nav (permitted roles only) | Master data, support/users, role-visibility, tutor approvals — sub-tab dropdown. |
| Auth (Login/Sign Up/Forgot Password) | Pre-authentication | Session entry. |
| Profile funnel (Setup/Pending Approval/Rejected) | Post-signup, before main shell | One-time or blocking states for incomplete/pending-review accounts. |

Modal stacks one level deep everywhere (booking confirmation, course-review, assignment-creation, submissions-review) — never a modal over a modal.

→ Composition reference: none yet — this spec was authored against the live, already-built product rather than new mockups. See Finalize's mock-coverage step for whether any surface still needs a rendered reference.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`.

| Do | Don't |
|---|---|
| "Welcome back, {name}! 👋 You are on a 14-day learning streak." | "Hey there! Ready to crush your goals today?? 🚀" |
| "Great job! You met the mastery threshold and earned +150 Mastery Points." | "OMG amazing!!! You're basically a genius now." |
| "No enrolled courses yet. Browse the course catalog below to enroll." | "Uh oh, nothing here yet. Better fix that!" |
| "Submitted — pending tutor review. Your score has been recorded and will appear here once your tutor reviews it." | "Hang tight, your teacher's grading your stuff!" |
| Specific and earned: streak days, exact point values, exact percentages. | Vague hype: "You're crushing it," "Keep up the great work!" without a number attached. |

FlexDemy celebrates *specific, measurable* achievement (a streak count, a point value, a passing threshold) rather than generic encouragement — the confetti and exclamation points are earned by a number crossing a line, not sprinkled by default.

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Dashboard section nav | Student & Tutor Dashboard | Click scrolls to the section (`scrollIntoView`, smooth); active section highlights via click-state, not scroll-spy. Sticky while its column is in view. Has a small-viewport equivalent (horizontal pill bar, see Responsive & Platform). |
| Stat/metric card | Dashboard hero row | Read-only display; no click action. Icon-well tint is the only per-card variation. |
| Course card | Discover, My Courses | Click anywhere on non-button area opens Course Overview. Progress bar only appears once enrolled. |
| Available Assignment card | Dashboard → Assignments (Student) | Source badge (Course/Tutor/Competition) always visible. "Attempt" CTA swaps to a status pill once a submission exists for that assignment — never both. |
| Quiz runner | Assignments → Attempt | Inline expansion below the Available list, not a modal — options lock after submit, explanations reveal per-question (Immediate) or are withheld entirely (Hold, see State Patterns). |
| Assignment creation modal | Dashboard → Assignments (Tutor) | Two save actions with genuinely different outcomes: "Save as Draft" (invisible to students) vs. "Save & Publish" (live immediately). Publish is disabled until at least one fully-filled question exists. A Published assignment's questions/answer key are **not** live-editable — the tutor must un-publish (back to Draft) before changing them; there is no in-place edit-while-live action. |
| Submissions review modal | Tutor's My Assignments card | Review = one-time confirm-and-reveal action on a pending score. Re-evaluate = a separate, always-available manual override on an already-reviewed score. The two are never the same button. Submitted (pending) rows are visually distinguished from Reviewed rows so the tutor can spot pending work at a glance. |
| Booking slot table/grid | Tutor Booking section | Booked slots are visually distinct (opacity/border) from open ones; "Book Slot" only renders on open slots. |
| Public Live Masterclass card | Dashboard → Tutor Booking (Student) / Broadcasting roster (Tutor) | Distinct from a 1-on-1 slot — shows a flat registration price (not a per-minute rate), a subscriber count, and a single "Register Seat" / "✓ Registered" toggle rather than a booking-confirmation modal. |
| Left-nav ↔ top-nav relationship | Dashboard vs. global Navbar | The Dashboard's left nav is a *secondary*, page-local nav; it never duplicates or replaces the global top Navbar's role as primary navigation between top-level surfaces. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Loading (initial) | Whole app | Full-screen spinner with visible label text ("Loading your workspace...") — never a bare spinner or blank screen. |
| Session-checking | Whole app | Same pattern, distinct label ("Checking your session..."). |
| Empty — no submissions | Dashboard → My Submissions (Student) | Hourglass icon + "No submissions yet" + a pointer at Available Assignments below, not a bare blank area. |
| Empty — no assignments created | Dashboard → My Assignments (Tutor) | Message + pointer at "Create Assignment," not a blank area. |
| Empty — zero submissions on a specific assignment | Submissions review modal | "No submissions yet for this assignment" — explicitly distinct from the Draft-has-zero-submissions-by-definition case; neither implies something is wrong. |
| Hold-visibility submitted | Quiz runner, after submit | No score, no per-question correct/incorrect marks, no explanations — only "Submitted — pending tutor review." Revealing partial correctness here would let a student infer the score and defeat the purpose of Hold. |
| Immediate-visibility submitted | Quiz runner, after submit | Full reveal: per-question correct/incorrect, explanations, score %, points, confetti at ≥70%. |
| Draft assignment | Available Assignments (Student) | Fully invisible — does not appear in the list at all, not a disabled/greyed card. |
| Booked slot | Tutor Booking grid | "BOOKED" pill, disabled action, opacity-reduced card — visible but clearly non-interactive. |
| Booking race lost | Tutor Booking grid, confirm modal | If a slot is booked by another student between browse and confirm, surface an explicit error on the confirm action — never a silent failure or a booking that appears to succeed. |
| Network/session error on refresh | Whole app | Silently falls back to Login rather than stranding the user on a broken loading state. |
| Master/Support Tutor Dashboard preview | Dashboard (Master/Support only) | Full Tutor Dashboard UI renders, but every data-bearing section (slots, submissions, assignments, courses) is forced empty — never another tutor's real data. This is a preview of the *layout*, not an impersonation tool; there is no path from this toggle to any specific real tutor's account. |
| Points/confetti on Hold-then-Reviewed reveal | Quiz runner (next view) / Submissions review (tutor) | Mastery points award at the moment the tutor publishes the review, not retroactively at original submission — the score was computed then, but nothing is granted until the tutor acts. Confetti plays for the student the next time they view the now-Reviewed submission, not for the tutor during Review. `[ASSUMPTION, inherited from the Assignments PRD's FR-14 tag]` |
| Points delta on Re-evaluate | Submissions review (tutor) | If a re-evaluated score crosses the ≥70% line in either direction, the student's point total adjusts by the delta (award or claw back) — no confetti re-fires; it's a correction, not a new completion. `[ASSUMPTION, inherited from the Assignments PRD's FR-15 tag]` |
| Persistent pre-session countdown | Global (`AppointmentToast`) | Distinct from ordinary transient confirmation toasts (see Interaction Primitives) — this one stays visible and live-updates a countdown once a booked session is within 60 minutes, rather than auto-dismissing after a few seconds. |
| Recent Activity feed | Student Dashboard | Currently static/illustrative content, not live data — do not treat what's rendered there as a real event log when reasoning about other states. |
| Empty — no search/filter results | Home (Discover) | "No courses match your filters" + a "Clear filters" action, not a bare blank grid. |
| Cold load | Home (Discover) | Skeleton course-card grid while the catalog fetches, not a spinner-only or blank screen. |
| Fetch error | Home (Discover) | Inline retry affordance in the catalog area — never a silent empty grid indistinguishable from "no results." |
| Empty room | Group Study | "No one's here yet — invite classmates or check back later," not a blank whiteboard/chat shell. |
| Connection loss / reconnect | Group Study | Live shared reader, whiteboard, and chat show an explicit "Reconnecting..." banner on drop, and resync state on reconnect rather than silently freezing or discarding in-progress edits. |
| Permission-denied | Group Study | A room a student isn't part of shows a clear "You're not in this room" state, not a broken/empty render. |
| Empty — no notes yet / no reviews yet | Course Overview | Each panel (Notes, Reviews) gets its own small empty-state message, not a blank tab. |
| Invalid credentials / signup validation / reset-flow errors | Auth (Login/Sign Up/Forgot Password) | Inline field-level error text (`{colors.error}`), same rule as other form validation in this spec — never a generic toast-only failure. |
| Pending Approval | Profile funnel | Dedicated blocking screen: "Your tutor application is under review" + expected-timeline copy, no access to the main shell. |
| Rejected | Profile funnel | Dedicated blocking screen stating the rejection plainly with next-step guidance (e.g. contact support), not a dead end. |
| Empty — no certificates yet | Certificates | "Complete a course to earn your first certificate" + a pointer at Discover, not a blank list. |
| Permission-denied | Admin | Non-permitted roles never reach this surface via nav, but a direct/stale route access shows an explicit "You don't have access" state, not a broken render. |
| Empty — zero pending items | Admin | Each Admin sub-tab (e.g. tutor approvals) states "Nothing pending" rather than rendering an empty table with no explanation. |

## Interaction Primitives

Mouse/touch-first, no keyboard-shortcut surface (unlike a power-user tool — FlexDemy's primary interaction is reading/clicking, not command-driven navigation).

- Click-anywhere-on-card opens detail (course cards, assignment cards) — buttons inside a card stop propagation where they need a distinct action (e.g. "Book Slot" inside a slot row).
- Smooth-scroll section jump (Dashboard left nav, Course Overview's sticky top nav) — never an instant jump-cut.
- Drag-and-drop for the Adaptive Schedule lesson planner only; no drag anywhere else in the product.
- Modals close via explicit "Close"/"Cancel" or the `X` control — no click-outside-to-dismiss on data-entry modals (assignment creation, booking confirmation) where an accidental dismiss would lose input; simpler read-only modals (submissions review) may allow it.
- Toasts for transient confirmations (sign-in/out, booking success) — auto-dismiss, non-blocking, never required reading. The one exception is the persistent pre-session countdown toast (see State Patterns) — it stays and live-updates rather than auto-dismissing, because it's time-sensitive, not a confirmation.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- WCAG 2.1 AA floor, product-wide — inherited from the existing global Accessibility & Voice Settings modal (high-contrast 7:1 mode, adjustable text sizing, screen-reader focus audio on Tab navigation, keyboard shortcuts cheat-sheet for the course reader). New surfaces (Dashboard sections, Assignments) inherit this unchanged rather than re-implementing it.
- "Skip to Content" link present on every authenticated page, first focusable element.
- Every loading state has visible text, not just a spinner (screen readers need the label).
- Form validation errors render inline in `{colors.error}` red with the specific problem stated, not a generic "invalid input."
- **Dashboard section nav (desktop + mobile pill bar):** each item is a real focusable button/link (not a `div` with an onClick), reachable via Tab in visual order, with a visible focus ring (`{colors.citrus-amber}` per `DESIGN.md.components.input.focusRing` — see the amber remediation note in `DESIGN.md.Colors`) and `aria-current="true"` (or equivalent) on the active section, not color-alone signaling.
- **Assignment creation modal:** every field has a programmatically associated `<label>` (not placeholder-as-label), the Draft/Publish disabled-state is exposed via `aria-disabled` with the reason available to assistive tech (not just a dimmed button), and focus moves into the modal on open and returns to the triggering "Create Assignment" button on close, per standard modal focus-trap practice.
- **Hold-then-Reviewed state transition:** when a Held submission flips to Reviewed and the score becomes visible, the change is announced to screen-reader users (e.g. an `aria-live="polite"` region on the status pill), not conveyed by a silent visual change from "Submitted" to "Reviewed."
- **Click-anywhere-on-card pattern** (course cards, assignment cards): the whole-card click target is layered under a real focusable/keyboard-operable element (Enter/Space activates it), not a `div onClick` with no keyboard equivalent — inner buttons that stop propagation remain independently reachable and operable.
- **Motion:** confetti, section-nav smooth-scroll, and the tab crossfade transition all respect `prefers-reduced-motion: reduce` — confetti and crossfade fall back to an instant/static equivalent, smooth-scroll falls back to an instant jump. None of these are purely decorative; all must degrade gracefully rather than being assumed exempt because they're "just" a celebration or a transition.

## Responsive & Platform

*(Triggered by the explicit "all pages should be responsive and full-width" constraint that opened this spec.)*

| Breakpoint | Behavior |
|---|---|
| `≥ lg` (1024px+) | Full desktop layout. Dashboard shows content + left section nav side-by-side. Navbar shows full desktop link row. |
| `< lg` | Navbar swaps to its existing bottom tab strip (`flex lg:hidden`). Dashboard's left section nav swaps to a horizontal sticky-top pill bar (`flex lg:hidden`, same sections/mechanism as the sidebar, styled like `CourseOverviewScreen.tsx`'s existing scroll-jump nav) — fixed during this spec's authoring, verified at a 500px viewport. |
| All breakpoints | Full-width (`w-full`, no `max-w-*`) is non-negotiable at every breakpoint, not just desktop — a narrow viewport gets full-bleed content with responsive padding, never a centered column. |

**Found and fixed after this spec's first Finalize:** the Tutor Dashboard's "Availability & Performance" section (`TutorEducatorHubView.tsx`) shipped `max-w-7xl mx-auto` on its root container — a centered, capped-width column, directly contradicting the row above. Every other Dashboard section (Assignments, Course Publishing) was already correctly full-width; this one component had carried the cap over from before the Tutor Hub merge and wasn't caught by the earlier DashboardSectionNav-focused pass. Fixed to `w-full`, matching every other section on the page.

FlexDemy is responsive web, not a native app; the product must remain fully *usable* (not merely "not broken") down to small-tablet width, per the new constraint. Below small-tablet, content should still render and function via the same full-width + stacked-layout rules Tailwind's breakpoints already apply throughout the codebase — this spec does not carve out an exception for phone-width viewports, it just doesn't optimize primarily for them.

## Key Flows

*(Mirrored from the two source PRDs' User Journeys — see `sources` in the frontmatter. Each PRD numbers its own journeys UJ-1/UJ-2; this spine disambiguates by PRD name in the heading since both use the same IDs.)*

### Dashboard PRD · UJ-1 — Priya opens Dashboard to keep learning and book help (Student)

1. Priya, mid-way through several courses, opens the app on a weekday evening, then navigates to the Dashboard tab. `[NOTE FOR UX]` The PRD's own UJ-1 text calls Dashboard the "default landing surface," but the actual app default (`App.tsx`'s initial `activeTab`) is Home/Discover, not Dashboard — this spine's Information Architecture table reflects the real code; the discrepancy is in the source PRD's phrasing, carried here as a corrected step rather than silently mirrored.
2. Sees her streak banner, taps "Resume Course." Glances at stat cards and 7-day activity calendar, checks her Weekly Goal ring, reviews her Adaptive Schedule.
3. Scrolls to My Courses, opens one.
4. Further down (or via the left nav's "Tutor Booking & Group Learning" jump), browses available 1-on-1 tutor slots for a subject she's stuck on, filters by subject, books a slot via the confirm modal.
5. Checks Group Study Pool options, requests one; browses Public Live Masterclasses, registers.
6. **Climax:** She has resumed a course *and* booked tutor help *and* joined a study group without ever leaving Dashboard or hunting for a separate tab.
7. Confirmation toast for the booking; the session appears under "My Booked Sessions" on the same page.

Edge case: no booked sessions yet → empty state, not an error.

### Dashboard PRD · UJ-2 — Raj opens Dashboard to run his teaching day (Tutor)

1. Raj, an approved Tutor, opens the app at the start of his teaching day. Lands on the same Dashboard tab — content is the Tutor Dashboard.
2. Flips himself Online. Glances at his earnings/hours/engagement chart.
3. Reviews his slot calendar — sees a new booking with topic on hover — adds open slots for the week.
4. Opens the Course Creation Wizard, publishes a new course. Checks his public-class broadcast roster.
5. **Climax:** Raj has a full picture of his teaching business and has published new content, all from the same page a Student would land on.
6. New slots are live and bookable immediately; the new course appears wherever published courses are listed.

Edge case: Offline → slots stay visible to Raj but aren't offered to students browsing.

### Assignments PRD · UJ-1 — Aditi checks and completes her assignments (Student)

1. Aditi opens her Dashboard, clicks "Assignments" in the left-side section nav.
2. Lands on My Submissions — past attempts with status pills (Submitted, Reviewed). Scrolls to Available Assignments — unified list across Course/Tutor/Competition sources, each with a source badge.
3. Opens one she hasn't attempted — the existing MC-quiz UI renders unchanged. She submits.
4. **Climax:** If Immediate visibility, she sees her score right away (auto-grade report, confetti/points, unchanged). If Hold, she instead sees "Submitted — pending tutor review" with no score yet.
5. The attempt appears in My Submissions with its current status; once a held submission is reviewed, status flips to "Reviewed" and the score appears.

Edge case: existing course/lesson quizzes always use Immediate visibility — Hold only exists for new tutor-created/competition assignments, so no currently-shipped behavior regresses.

### Assignments PRD · UJ-2 — Raj creates an assignment and grades submissions (Tutor)

1. Raj clicks "Assignments" in the Tutor Dashboard's left nav. Sees My Assignments (Draft/Published), clicks "Create Assignment."
2. Fills in title, description, links a course or flags "Open/Competition." Adds MC questions with a correct-answer key. Chooses Visibility Mode (Immediate or Hold). Saves as Draft or Publishes.
3. Students submit; Raj opens the assignment's Submissions view, sees each auto-computed score.
4. **Climax:** For "hold" submissions, he reviews and publishes the result (score becomes visible, status → Reviewed). For any already-reviewed submission, he can re-evaluate — manually override the score.
5. Published assignments and their submission states are exactly what students see in UJ-1's Available Assignments / My Submissions.

Edge case: a Draft assignment has zero submissions by definition — invisible to students until Published.
