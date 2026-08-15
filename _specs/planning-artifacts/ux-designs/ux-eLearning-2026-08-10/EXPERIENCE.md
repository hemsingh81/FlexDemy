---
title: FlexDemy Experience Spec
status: final
created: 2026-08-10
updated: 2026-08-15
name: FlexDemy
sources:
  - {planning_artifacts}/prds/prd-eLearning-2026-08-10/prd.md
  - {planning_artifacts}/prds/prd-eLearning-Assignments-2026-08-10/prd.md
  - {planning_artifacts}/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md
  - {planning_artifacts}/prds/prd-eLearning-CourseWizard-2026-08-10/addendum.md
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
| Dashboard | Top nav | Role-routed single home. Student: Weekly Goal → Adaptive Schedule → My Courses → Assignments → Tutor Booking & Group Learning. Tutor: Availability & Performance → **New Course Wizard** (metadata steps 1–4 in the side-panel; supersedes the old flat 4-step wizard — see Component Patterns and Course Content Editor row below) → **My Courses** (a distinct, Tutor-only surface from the Student My Courses above despite the shared name — every course the tutor owns, any lifecycle state, with Resume/Take Offline/Delete actions; see Component Patterns) → Assignments. Left-side section nav on both (see Responsive & Platform). |
| **Course Content Editor** | Two entry points, same surface: (1) Wizard's Content step (Tutor), reached after Steps 1–4 (Title/Tags/Taxonomy/Thumbnails) complete on a freshly-created course — opens at the top of the page, above every other Dashboard section; (2) **My Courses'** Resume action (Tutor, Draft courses only) on an already-existing course — opens inline, directly beneath that course's own row (see Component Patterns' My Courses row), full width within My Courses' own card rather than the standalone centered/capped width entry-point (1) uses. Only one can be open at a time. | *New surface (New Course Wizard PRD).* Full-width Chapter→Topic→Subtopic→Content tree: per-file upload/parsing/AI-extraction status, add/edit/delete/reorder any node, per-node confirm, subject-aware rendering (math/chemistry via KaTeX+mhchem, images, tables, Hindi). Breaks out of the side-panel because the tree editor and rich rendering don't fit a 640px blade (see Do's and Don'ts). Also hosts **Review as Student** mode (full live preview of the tutor's own course, gating Publish) and the Draft/In Review/Review Confirmed/Published lifecycle actions. Bordered/shadowed card shell (`{components.course-content-editor}` in DESIGN.md), with a header **Maximize/Restore** toggle: Normal (default) has no sticky header either way, so a tutor lands with the surrounding page still visible; from entry point (1) it's a centered, capped-width card, while from entry point (2) — already embedded inside My Courses' own card — it fills that card's full width instead (no double-nested card-within-a-card cap). Maximize turns it into a true full-viewport takeover (above the Navbar, no card-shell chrome) for a genuinely distraction-free editing session regardless of which entry point opened it, and Restore returns to Normal. → [`mockups/key-course-content-editor.html`](mockups/key-course-content-editor.html) *(rendered before the card shell/Maximize-Restore toggle existed — visually stale, not yet refreshed)*; Publishing state → [`mockups/key-publishing-state.html`](mockups/key-publishing-state.html). |
| Course Overview | Course card ("Course Overview") | Full detail on one course: syllabus, progress, notes, reviews. Sticky top scroll-jump sub-nav (existing pattern, distinct from Dashboard's left nav). Its syllabus shows a separate per-lesson "assignment badge" — a different, unreconciled surface from the Dashboard's Assignments Source badges; the two are not yet unified (deferred per the Assignments PRD). |
| Course Player | "Start/Resume/Continue Learning," or a lesson's "Take Quiz" (→ Dashboard Assignments) | Interactive lesson reader. Every Topic/Subtopic now carries four adaptive-learning affordances (New Course Wizard PRD): the existing 5-level concept drilldown, now wired to real AI-generated content instead of mock data; a secondary "explain a different way" menu (5 Ways, each with its own example); an optional inline practice exercise; and click-any-keyword definitions. Audio narration unchanged. → [`mockups/key-course-player-adaptive.html`](mockups/key-course-player-adaptive.html). |
| Group Study | Top nav | Synchronous peer study rooms — live shared reader, whiteboard, chat. Distinct from Dashboard's Group Study *Pool* requests (async matchmaking, not live sessions). |
| Certificates | Top nav | Earned certificates + leaderboard. |
| Admin | Top nav (permitted roles only) | Master data, support/users, role-visibility, tutor approvals, **Tag Management**, **AI Configuration & Usage** — sub-tab dropdown. Gating split by sensitivity (decided in review): **Tag Management** is available to Support as well as Master — expands Support's current single-subtab scope (today just Tutor Approvals) since tag hygiene is routine vocabulary upkeep, not a cost lever. **AI Configuration & Usage** is Master-only, matching its direct control over spend and model routing. |
| Auth (Login/Sign Up/Forgot Password) | Pre-authentication | Session entry. |
| Profile funnel (Setup/Pending Approval/Rejected) | Post-signup, before main shell | One-time or blocking states for incomplete/pending-review accounts. |

Modal stacks one level deep everywhere (booking confirmation, course-review, assignment-creation, submissions-review) — never a modal over a modal.

→ Composition reference: the original Dashboard/Assignments content was authored against the live, already-built product rather than new mockups — still no rendered reference for those surfaces. The New Course Wizard PRD's three highest-ambiguity new surfaces (Course Content Editor, Course Player's adaptive affordances, the Publishing checklist state) do have rendered references in `mockups/` — linked from their respective rows above. All other New Course Wizard surfaces (metadata wizard steps, Admin tables, version history, crop tool) were confirmed spine-only at mock-coverage — no reference needed.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`.

| Do | Don't |
|---|---|
| "Welcome back, {name}! 👋 You are on a 14-day learning streak." | "Hey there! Ready to crush your goals today?? 🚀" |
| "Great job! You met the mastery threshold and earned +150 Mastery Points." | "OMG amazing!!! You're basically a genius now." |
| "No enrolled courses yet. Browse the course catalog below to enroll." | "Uh oh, nothing here yet. Better fix that!" |
| "Submitted — pending tutor review. Your score has been recorded and will appear here once your tutor reviews it." | "Hang tight, your teacher's grading your stuff!" |
| Specific and earned: streak days, exact point values, exact percentages. | Vague hype: "You're crushing it," "Keep up the great work!" without a number attached. |
| "Extracting Chapter 3 of 5... 2 files complete." | "AI is working its magic! ✨" |
| "This file couldn't be processed — the scan quality was too low to read reliably. Try re-uploading a clearer copy." | "Oops, something went wrong!" |

FlexDemy celebrates *specific, measurable* achievement (a streak count, a point value, a passing threshold) rather than generic encouragement — the confetti and exclamation points are earned by a number crossing a line, not sprinkled by default. The same specificity discipline extends to AI-status and error copy (New Course Wizard PRD): name the actual step and count, or the actual reason something failed, rather than a vague or falsely-anthropomorphized placeholder.

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
| New Course Wizard (metadata) | Dashboard → Course Publishing (Tutor) | Same side-panel shell/step-swap discipline as the old wizard (`{components.side-panel}`, "Step N of 4" subtitle), but only for Title, Tags, Taxonomy, Thumbnails. Tags step is a searchable type-ahead multi-select against the admin Tag list, not free text; a tag deactivated after being attached to this course stays visible as an attached chip but is not re-addable if removed — visually distinct from an active, freely re-addable chip, not silently identical. Taxonomy step is 6 cascading dropdowns (Country→State→City→Board→Class Level→Subject); each child is disabled until its parent is chosen, and State/City's requirement is board-dependent (read from master data, not hardcoded). Thumbnails step includes an in-step crop tool enforcing a fixed aspect ratio before an image is accepted (`[ASSUMPTION: 16:9, per the PRD's own recommendation]`), plus button-based (not drag — drag is reserved for exactly two surfaces, see Interaction Primitives) reorder/delete/set-primary controls on each of up to 3 thumbnails; attempting a 4th upload is rejected inline with a clear "maximum 3 thumbnails" message rather than silently failing. Completing Step 4 opens Course Content Editor, not a 5th blade step. |
| My Courses (Tutor) | Dashboard, directly beneath the New Course Wizard trigger card (Tutor) | *New surface, previously undocumented — captured here retroactively, same "ground directly in already-built code" precedent this spine has followed since its first draft.* Every course the tutor owns, any lifecycle state (Draft/In Review/Review Confirmed/Published), each row showing title, last-edited date, and a status badge (`{components.badge-pill}`, reusing the exact navy-in-progress/green-done split `PublishLifecycleBar` already established — no new color language). A distinct surface from the Student-facing "My Courses" in the IA table above despite the shared name — this one is Tutor-only, resume/manage-oriented, not enrolled-course browsing. Per-row actions vary by state: **Resume** (Draft only — a further-along course's edit endpoints reject a non-Draft id server-side, so the action simply isn't offered rather than being offered and failing); **Take Offline** (Published only — the sole path back to Draft, no confirm step, mirroring `PublishLifecycleBar`'s own "Return to Draft" action); **Delete** (every other state — Draft/In Review/Review Confirmed — gated by `{components.modal}`'s centered confirm pattern, a genuinely destructive action). Clicking Resume opens Course Content Editor inline, directly beneath that row (see the Course Content Editor row above) — not the Wizard hand-off's standalone top-of-page placement. The list itself doesn't refetch while any Course Content Editor is open (either entry point), to avoid the list visibly shifting under a tutor mid-edit; it refetches once the editor closes, or after a successful Take Offline/Delete. |
| Course Content Editor — tree node | Course Content Editor | One row per Chapter/Topic/Subtopic/Content Block: expand/collapse, edit-in-place, delete, drag-reorder (same family as the Adaptive Schedule's existing drag-and-drop, the only other drag surface in the product), and an explicit per-node **Confirm** action distinct from having edited it. Deleting a Chapter or Topic cascades to every descendant node — a genuinely destructive, hard-to-undo action — so it goes through `{components.modal}`'s centered confirm pattern (same discipline as an Admin row delete), not a plain click-and-it's-gone action; deleting a leaf Content Block with no descendants does not need the extra confirm step. Unconfirmed nodes block Review as Student; confirming after a text-only edit is not required, confirming after a structural edit or one that touches AI-generated Drill-Down/Ways content is required (re-reverts to unconfirmed). |
| Course Content Editor — Maximize/Restore | Course Content Editor, header | Icon-button pair toggles between Normal (default on every open — centered `max-w-4xl` card, header not sticky, scrolls with the page like any other card, `{components.course-content-editor}`'s `shadow-lg`) and Maximized — a true full-viewport takeover (`fixed inset-0`, stacking above the Navbar rather than sitting below it), edge-to-edge with no card-shell border/rounding/shadow, header pinned at the top while the tree scrolls beneath it — reached only by an explicit Maximize click. The choice is session-local, not persisted: every fresh open resets to Normal, so a tutor is never handed a prior session's full-screen takeover without asking for it again. See DESIGN.md's Do's and Don'ts for why Normal's width cap — now the default, not just a toggled-away-from state — is a deliberate exception to the app's `w-full` rule rather than a regression of it. |
| Course version history | Course Content Editor, post-publish | *New surface, lightly specified — the PRD leaves version storage depth as an explicit open architecture question.* A simple list of prior published versions (timestamp, publisher) with a view/restore action, surfaced from Course Content Editor rather than as its own top-level page. `[ASSUMPTION: list-based UI, no diff/comparison view — the PRD doesn't ask for one and the storage mechanism itself isn't decided yet, so this stays minimal until architecture resolves FR-25's data model]`. |
| Extraction status indicator | Course Content Editor, per uploaded file | Queued / Parsing / Extracting / Done / Failed, using `{components.badge-pill}`'s existing semantic colors (navy = in-progress, green = done, red = failed) — not a new color language. Queued and Parsing (the two in-progress statuses) additionally carry a small spinner inline before the label, so "still working" reads at a glance rather than as a static pill (see `{components.extraction-status-badge}` in DESIGN.md). Failed shows two independent inline actions scoped to that file only: Retry (re-submits the same file) and Delete (removes it outright, no confirm step — a failed file never had any content extracted, unlike the separate ConfirmModal-gated delete on an already-Done file's content card); other files' progress is unaffected either way. Each status transition is announced via a scoped `aria-live="polite"` region on that file's row (batched/throttled if many files finish near-simultaneously, not one announcement per file in a flood) — see Accessibility Floor. |
| Drill-Down panel | Course Player, "Explain more" | Existing component (`DrilldownPanel.tsx`), right-docked, `max-w-2xl` (672px, wider than the standard `{components.side-panel}` scale — already stretched for LaTeX rendering room, a useful precedent for Course Content Editor's own width decision). **Confirmed by reading the live code: this component has never been brand-remediated** — it currently uses off-brand indigo/emerald Tailwind colors throughout (level tabs, key-takeaway bullets, example difficulty badges) instead of `{colors.ink-navy}`/`{colors.citrus-amber}`/`{colors.signal-green}`, unlike the Course Wizard panel and other Tutor modals, which were swept in an earlier pass (see DESIGN.md's Do's and Don'ts). Decided in the accessibility review: the color sweep is **in scope for this same implementation pass**, not a deferred follow-up — wiring this panel to real AI content (FR-17) is the first time it ships to production with real content behind it, so it does not ship on colors with unconfirmed AA contrast. |
| Adaptive Ways menu | Course Player, per Topic/Subtopic | Secondary to Drill-Down's primary "Explain more" action, not a peer button (decided during the PRD's review) — opens a small menu/tray cycling the 5 Ways, each with its own worked example. Level 1 of Drill-Down carries a visible textual nudge toward it (e.g. "Not clicking? Try a different explanation") rather than leaving it undiscoverable. Placement confirmed at Finalize's key-screen mock — see [`mockups/key-course-player-adaptive.html`](mockups/key-course-player-adaptive.html). |
| Exercise runner | Course Player, per Topic/Subtopic (optional) | Inline, not a modal — same "expands in place" discipline as the existing Quiz runner. Subject-appropriate input per exercise: multiple choice and short text use standard form controls; numeric/math answers are captured as plain keyboard text entry (LaTeX-like or plain-number, per exercise), not a mouse-only visual equation-editor widget — keeps the answer input as keyboard-native as everything else in the system. Submitting shows immediate feedback and/or worked solution without a page reload; a node with no attached exercise shows no practice affordance at all (no empty/disabled state). |
| Keyword definition popover | Course Player, any keyword in content | Each keyword renders as a real focusable/keyboard-operable inline control (a real button-like element, not a `span` with only an `onClick`), reachable in normal Tab order and activated by Enter/Space — same "real element, not div/span onClick" discipline as the Dashboard section nav and click-anywhere cards. Inline popover anchored to the clicked/activated word, not a modal or panel — dismisses on click-elsewhere or `Escape`, same lightweight-dismiss discipline as read-only-ish surfaces (see Interaction Primitives). Definition is subject/language-aware; a tutor-authored override (if present) is visually unmarked as an override — a student never needs to know whether a definition is AI- or tutor-written. `[NOTE FOR UX]` Keyword density per passage could make linear Tab-traversal impractical (dozens of keywords in one paragraph) — if that turns out to be real, a per-paragraph "glossary" affordance is the fallback, not decided here since it depends on how dense keyword-tagging actually gets in practice. |
| AI Configuration table | Admin → AI Configuration & Usage | One row per AI Task (`extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, embeddings), each with its own provider/model selector, fallback selector, and budget threshold field — edits save independently per row, not as one form. `describeNotation` is a 7th task added during this spec's accessibility review — it generates the screen-reader alt-text for rendered math/chemistry notation (KaTeX+mhchem), a first-class budgeted pipeline step rather than an unbacked assertion (see Accessibility Floor). Usage/cost is broken out by task and date range in the same surface, reusing `{components.card-stat}`/chart patterns from the Dashboard rather than a new visualization language. |
| Tag Management table | Admin → Tag Management | Same list/search/CRUD shell as `{components.card-section}`-based Admin tables elsewhere (e.g. Master Data), not a new pattern — add, rename, deactivate, search; duplicate names (case-insensitive) rejected inline. Net-new work, not an extension of Master Data Manager's existing scaffold (§0/reuse note). |

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
| File parsing/extraction in progress | Course Content Editor, per uploaded file | Queued → Parsing → Extracting status label per file (see Extraction status indicator), not a single blended progress bar for the whole batch — files that finish first show their tree immediately rather than waiting on the slowest file. |
| Extraction failed (per file) | Course Content Editor | That file's row shows a failed state with scoped Retry and Delete actions (Delete needs no confirm step — nothing was extracted to lose); the other files' already-extracted structure remains usable and untouched. |
| Node pending confirmation | Course Content Editor | Unconfirmed nodes visually distinct from confirmed ones (e.g. a dimmed/outlined treatment vs. a solid confirmed state) — Review as Student stays disabled while any remain, same "can't proceed until X" discipline as the Assignment creation modal's Publish-disabled state. |
| Publishing (async batch) | Course Content Editor, after Confirm Review → Publish | Transient state while Drill-Down/Ways content generates for every confirmed node in the background — course is not yet `Published`. Decided in review: a node-by-node checklist ("12 of 34 confirmed nodes generated"), not a spinner or single blended bar — at an estimated 200+ AI calls per publish batch (one `explainTopic`/`rewriteExplanation` call per level/way per node), this runs low minutes not seconds, and a spinner that long reads as broken. Runs server-side and survives the tutor closing the tab — reopening the course shows the same in-progress checklist rather than restarting the batch or losing the state. The same "a static spinner reads as broken over this duration" reasoning extends to non-visual users: the checklist container is an `aria-live="polite"` region announcing meaningful increments (not a play-by-play of all 200+ calls) and always announcing terminal states (complete, or any failure) — see Accessibility Floor. |
| Node generation failed during Publish batch | Course Player, live (post-publish) | Per PRD FR-21's reliability guarantee, a student opening a node whose pre-generation failed never sees an empty Drill-Down level or Way — it generates on-demand instead, same latency expectation as Keyword Definitions below, not a visible "failed" state to the student. The failure is only visible to Admin (see Node generation degraded row below), never surfaced as broken to the learner. |
| Node generation degraded (fallback-served) | Course Content Editor / Admin AI Configuration | Per the PRD's FR-3, a fallback-served (vs. primary-model) generation is logged and flagged to Admin — surfaced here as a badge/indicator in the AI Configuration usage view, not silently absorbed into the same "Done" state as a normal generation. |
| Loading | My Courses (Tutor) | "Loading your courses…" text, not a bare spinner — same "every loading state has visible text" discipline as the rest of this spec (see Accessibility Floor). |
| Empty — tutor has no courses yet | My Courses (Tutor) | "No courses yet — start with New Course Wizard above" — points at the trigger rather than a bare blank list. |
| Load failure | My Courses (Tutor) | The whole list is replaced by a friendly error message (nothing to show at all) — distinct from an action failure below, which happens on top of an already-rendered list. |
| Resume/Take Offline/Delete action failure | My Courses (Tutor) | A friendly inline error, but the list (including the course the action was attempted on) stays visible and untouched — an action failing must never make the already-rendered list disappear behind the error, unlike a load failure above. |
| Take Offline in progress | My Courses (Tutor), that row's action button | Button label swaps to "Taking Offline…" and disables for that row only — the rest of the list stays interactive. |
| Delete in progress | My Courses (Tutor), that row's action button | Same per-row pattern as Take Offline in progress: button label swaps to "Deleting…," disables for that row only. |
| Empty — no keyword definition available | Course Player, keyword popover | If `defineKeyword()` fails or returns nothing, the popover shows a plain "Definition unavailable" message, not a blank/broken popover shell — same "never a silent empty state" discipline as every other empty state in this spec. |
| Empty — no exercise attached | Course Player, per Topic/Subtopic | No practice affordance renders at all (not a disabled button) — matches Draft assignment's "fully invisible, not disabled" pattern above. |
| Budget threshold approaching / exceeded | Admin → AI Configuration & Usage | Approaching (e.g. 80%) surfaces an icon + text warning on that AI Task's row before the hard limit — never color-alone, since `{colors.warning}` doesn't clear AA for small text (see Accessibility Floor); exceeded blocks new requests for that task (or routes to a configured fallback) — same distinction as Booking race lost above: never a silent failure, always an explicit, actionable state. |

## Interaction Primitives

Mouse/touch-first, no keyboard-shortcut surface (unlike a power-user tool — FlexDemy's primary interaction is reading/clicking, not command-driven navigation).

- Click-anywhere-on-card opens detail (course cards, assignment cards) — buttons inside a card stop propagation where they need a distinct action (e.g. "Book Slot" inside a slot row).
- Smooth-scroll section jump (Dashboard left nav, Course Overview's sticky top nav) — never an instant jump-cut.
- Drag-and-drop for the Adaptive Schedule lesson planner, and now also Course Content Editor's tree-node reordering (New Course Wizard PRD) — the only two drag surfaces in the product; no drag anywhere else.
- Modals close via explicit "Close"/"Cancel" or the `X` control — no click-outside-to-dismiss on data-entry modals (assignment creation, booking confirmation) where an accidental dismiss would lose input; simpler read-only modals (submissions review) may allow it. The Course Content Editor is not a modal in either state — Normal is a page surface, Maximized is a full-viewport takeover, and neither has a dimmed backdrop over other visible content, so neither has a backdrop-dismiss question; toggling between them only changes size/position, not this category. Unsaved-edit protection on navigating away follows the same "don't lose input" principle regardless of which state it's in.
- Toasts for transient confirmations (sign-in/out, booking success) — auto-dismiss, non-blocking, never required reading. The one exception is the persistent pre-session countdown toast (see State Patterns) — it stays and live-updates rather than auto-dismissing, because it's time-sensitive, not a confirmation.
- Keyword definition popovers (New Course Wizard PRD) dismiss on click-elsewhere or `Escape`, same lightweight-dismiss family as read-only-ish modals — never a modal-weight interaction for a one-line definition lookup.
- The Adaptive Ways menu cycles freely in any order (no forced sequence) on click/tap; Drill-Down levels remain strictly sequential (one level at a time) — the two adaptive-learning modes intentionally have different interaction disciplines, not a shared "next" pattern.

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
- **Motion:** confetti, section-nav smooth-scroll, the tab crossfade transition, the Adaptive Ways menu's open/close tray animation, the keyword popover's appear/dismiss transition, and the Publishing checklist's incremental-fill animation all respect `prefers-reduced-motion: reduce` — confetti and crossfade fall back to an instant/static equivalent, smooth-scroll falls back to an instant jump, the tray/popover/checklist fall back to an instant show/hide/update. None of these are purely decorative; all must degrade gracefully rather than being assumed exempt because they're "just" a celebration or a transition.
- **Course Content Editor tree node:** add/edit/delete/reorder/confirm are each independently reachable and operable via keyboard, not drag-only or hover-only — reordering has a keyboard-accessible equivalent to drag-and-drop (e.g. move-up/move-down actions), consistent with the product's mouse/touch-first-but-not-mouse-only baseline. Each node's confirmed/unconfirmed state is exposed to assistive tech (not color-alone), same discipline as the Dashboard section nav's `aria-current` rule above. When an edit auto-reverts a node from Confirmed back to Unconfirmed (per the small/not-small edit rule), that reversion is announced at the moment it happens (visually and via `aria-live="polite"`) — not just reflected passively in the node's persistent state indicator, since a tutor may not expect their edit to have un-confirmed the node.
- **Course Content Editor — unsaved-edit protection:** autosave on each node's edit-then-blur (the per-node Confirm action is already a natural save point) rather than a page-level "leave without saving?" confirmation dialog — given how long a tree-editing session can run, relying on a single beforeunload prompt at the very end is the weaker mechanism.
- **Course Content Editor — lifecycle-stage orientation:** the wizard's "Step N of 4" persistent orientation doesn't end at the handoff to Course Content Editor — a persistent Draft → In Review → Review Confirmed → Published indicator lives in the editor's header, current stage marked both visually and via `aria-current`, so a tutor doesn't lose "where am I in the publishing flow" exactly when the task gets longer and more complex. In Maximized state this header is sticky (pinned while the tree scrolls beneath it); in Normal state (the default) it isn't — the indicator is still always visible at the top of the card, just not pinned during scroll, since a smaller card has far less scroll distance for it to disappear over.
- **Course Content Editor — Maximize/Restore:** the header icon-button pair (toggles between Normal and Maximized — see Component Patterns) is a real, independently focusable `<button>` with an explicit accessible name that states what clicking it does next ("Maximize Course Content Editor" / "Restore Course Content Editor"), not an icon-only control with no text alternative — same discipline as every other icon-only action in this spec (e.g. the file-delete trash icon).
- **Thumbnail crop tool:** crop handles are independently keyboard-focusable and adjustable (arrow keys nudge position/size in fixed steps, or a numeric x/y/zoom input alternative) — not drag-only, which is one of the most reliably keyboard-inaccessible UI patterns. The fixed-aspect-ratio constraint is announced to assistive tech so a keyboard user understands why free resize isn't offered.
- **Math/chemistry rendering (KaTeX+mhchem):** rendered notation carries `alt`/`aria-label` fallback text generated by a dedicated AI Task (`describeNotation`, added to the AI Configuration table alongside the other six — see Component Patterns), not assumed to fall out of the extraction/explanation pipeline for free or left for a screen reader to parse raw KaTeX markup.
- **Hindi (Devanagari) content — language of parts (WCAG 3.1.2):** a distinct requirement from the alt-text rule above, since Devanagari is real, navigable Unicode text, not a rendering needing a fallback. Hindi passages/content blocks carry `lang="hi"` (or the appropriate BCP-47 tag) so a screen reader switches pronunciation/voice engine correctly instead of reading Devanagari script with English phonetic rules.
- **Extraction status and Publishing progress announcements:** the same `aria-live="polite"` discipline applied to the keyword popover and Hold-then-Reviewed above extends to these two async surfaces too (see State Patterns) — per-file extraction status changes and Publishing's node-count increments are announced, not silently visual-only, since these are the longest-running new async states in the spec — the two states the checklist treatment most explicitly protects a sighted user from perceiving as "broken."
- **Keyword definition popover:** decided in review — focus stays on the reading text, never jumps into the popover; the definition is announced via `aria-live="polite"` instead, so a screen-reader user doesn't lose their place mid-sentence the way a sighted reader never does. Same principle as the Hold-then-Reviewed status announcement above, and the reason this popover is deliberately lighter-weight than the Assignment creation modal's focus-trap discipline — it's a lookup, not a task. Each keyword's Tab-reachable activation is covered under Component Patterns above.
- **Adaptive Ways menu:** each Way is independently focusable/operable (not a mouse-only carousel), and the currently-displayed Way is exposed via `aria-current` or equivalent, matching the Dashboard section nav's active-state accessibility rule rather than inventing a new pattern.
- **Budget threshold warning (Admin):** icon + text, never color-alone (`{colors.warning}` is known not to clear the 4.5:1 text threshold — see `DESIGN.md.Colors` — so this renders as an icon/badge-fill use, which does clear 3:1, not small warning-colored text); the threshold crossing is exposed to assistive tech via `aria-describedby` on the affected AI Task's row.

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
4. Opens the Course Creation Wizard, publishes a new course. Checks his public-class broadcast roster. `[NOTE FOR UX]` As of the New Course Wizard PRD, "the Course Creation Wizard" here means the superseded 4-step flow (Dashboard PRD's FR-18) — the real flow is now the metadata side-panel (Steps 1–4) handing off to Course Content Editor, per New Course Wizard PRD · UJ-1 below. Carried here unchanged since this is a mirror of the Dashboard PRD's own journey text, not a re-authored one; see UJ-1 for the current flow.
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

### New Course Wizard PRD · UJ-1 — Meera turns a scanned chemistry chapter into a structured course (Tutor)

1. Meera opens the New Course Wizard from Dashboard's Course Publishing, completes Steps 1–4 (Title, Tags, Taxonomy, Thumbnails) in the side-panel, same shell/step-swap discipline as the old wizard.
2. Advancing past Step 4 opens Course Content Editor as a new page-level surface (not a 5th blade step), landing in its default Normal card rather than taking over the full screen. She drags her scanned PDF in; a per-file status label shows "Uploading → Parsing → Extracting."
3. Within a couple of minutes the Chapter→Topic→Subtopic tree appears, populated with extracted content and chemistry notation rendering in her original formulas.
4. **Climax:** She reviews the tree, drags a mis-split Subtopic under the correct parent, edits a garbled sentence in place, and taps **Confirm** on each node.
5. All nodes confirmed; **Review as Student** becomes available on the same surface.

Edge case: one file fails to parse (corrupted scan) — only that file's row shows a failed/retry state; the rest of her structure is untouched and she keeps working.

### New Course Wizard PRD · UJ-2 — Aarav doesn't get momentum the first time, and finds it a second way (Student)

1. Aarav opens a Course Player topic at its default Level 1 Drill-Down explanation — reads it, doesn't click.
2. Sees the visible nudge toward the Adaptive Ways menu ("Not clicking? Try a different explanation"), opens it, cycles Ways until a car-crash analogy lands, complete with its own worked example.
3. Taps a bolded keyword ("inertia") inline — gets a popover definition without losing his place in the reading text.
4. **Climax:** Confident on the concept, he opens the optional exercise attached to the topic and submits an answer, getting immediate feedback.
5. He closes the app; nothing about this session required leaving Course Player.

Edge case: a topic with no exercise attached shows no practice affordance at all — not a broken or disabled state.

### New Course Wizard PRD · UJ-3 — Rohan swaps the production model for one task without touching code (Admin)

1. Rohan opens Admin → AI Configuration & Usage, finds the `explainTopic` row (Drill-down).
2. Changes its assigned model, saves — the row updates independently of every other AI Task's row.
3. **Climax:** The next Drill-Down generation for any course uses the new model — no deploy, no code change.
4. The Usage/cost view begins reflecting the new model's per-task spend from that point forward, broken out the same way as every other task.

Edge case: if the newly-configured model/provider is unreachable, fallback behavior (per the PRD's FR-3) applies the same as any other AI Task, and the fallback event is flagged in this same Usage view — not silently absorbed.

### New Course Wizard PRD · UJ-4 — Meera reviews her own course exactly as a student would before publishing (Tutor)

1. With every node confirmed, Meera opens **Review as Student** from Course Content Editor.
2. She experiences the course exactly as a student would: expands a Drill-Down level, cycles a Way, attempts the practice exercise, clicks a keyword.
3. **Climax:** Everything renders and behaves as intended; she taps **Confirm Review**.
4. **Publish** becomes available for the first time in this course's lifecycle; publishing enters the Publishing state (see State Patterns) before the course goes live.

Edge case: if she finds a problem while reviewing, she returns to Course Content Editor to fix it — any structural or AI-content-affecting edit reverts confirmation on that node, requiring re-confirm before Review as Student is available again.
