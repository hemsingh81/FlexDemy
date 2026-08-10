# Reconciliation: FrontEnd/docs/FRONTEND_PRD.md (§4.3 + §4.6, and other Dashboard/Tutor Hub references) vs. new prd.md

Input reconciled: `FrontEnd/docs/FRONTEND_PRD.md` (full read), focused on §4.3 "Dashboard & Weekly Goal Tracker" and §4.6 "Tutor Hub & Educator Dashboard", plus a full-document scan for any other "Dashboard"/"Tutor Hub" reference.
Target: `_specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md`

---

## 1. Concrete details/requirements missing or contradicted in the new PRD

### 1.1 Course discovery (grade filter + search) appears dropped from "My Courses" (FR-8)
Old §4.3 had a distinct sub-feature, **"Grade & Tag Strict Filtering"**, separate from the Course Card:
- Filter pills for target grades: *All, Class 10th, Class 12th, Undergrad, PhD Level*.
- Search bar filtering by course title, subject tags (e.g., "Physics", "Calculus"), or description.

New PRD **FR-8 "My Courses list"** only says: "Student sees enrolled courses with sort options (recently accessed / completion % / alphabetical) and per-course/per-module progress bars." There is no mention of grade-pill filtering or the search bar anywhere in §4.2–§4.5, and it isn't called out in §5 Non-Goals either — it simply isn't addressed.

This isn't just a wording gap: the old §4.3 feature set reads as **course discovery/browsing** (filter by grade, search, rating, enrolled count — marketplace-style signals) layered on top of the student's *enrolled* courses, not just sorting an enrolled list. The new PRD's FR-8 is narrower — enrolled-only, sort-only. Supporting evidence this was a real, data-backed feature: old §6 Frontend State Management explicitly lists `Course[]` with `targetGradeTag` and `tags` fields — built specifically to support this filtering, reinforcing this wasn't decorative copy.

**Recommendation:** Either explicitly fold grade-filter/search into FR-8 as a testable consequence, or add an explicit Non-Goal/Assumption stating course discovery-by-grade is deferred/out of scope and why.

### 1.2 Course Card fields dropped from FR-8
Old §4.3 Course Card: "Thumbnail image, instructor avatar, grade tag badge, rating, enrolled count, and 'Course Overview' button." New FR-8 mentions only "per-course/per-module progress bars." Rating, enrolled count, instructor avatar, grade tag badge, and the specific "Course Overview" button/CTA label are not mentioned or reasoned about anywhere in the new PRD.

### 1.3 Weekly Goal Card: range and persistence semantics narrowed (FR-6)
Old §4.3: "Goal Setter Modal allowing users to adjust weekly study target (**e.g. 5–30 hours**) with **instant local state persistence**."
New FR-6: "Student can view progress toward a weekly study-hours goal (SVG ring) and edit the target via a goal-setter modal, **persisted via the existing goal service**."

Two losses:
- The concrete 5–30 hour bound is dropped (not restated, not flagged as removed).
- "Instant local state persistence" (old) vs. "persisted via the existing goal service" (new) are not obviously the same guarantee — "instant local" implies immediate, client-side, no-round-trip persistence; "via the existing goal service" reads as a network/service call. If the underlying implementation is unchanged, this is just wording; if it's actually a service call, the new PRD has silently changed a UX latency guarantee. This should be verified against the actual `features/Dashboard/` code and either confirmed identical or flagged as a behavior change.

### 1.4 Quick Continue Banner details narrowed (FR-4)
Old §4.3: "Quick Continue Banner: Displays **active course, current lesson, and progress percentage** with instant 'Continue Learning' trigger."
New FR-4: "Student sees a welcome/streak banner with a 'Resume Course' call-to-action pointing at their most recently active course."

- The display of **current lesson name** and **progress percentage** on the banner itself is not mentioned in FR-4 (FR-5's stat cards show aggregate stats — Day Streak, Enrolled Courses, Mastery Points, Time Spent — not per-course lesson/progress, so this isn't clearly subsumed elsewhere).
- The CTA button copy changes from "Continue Learning" (old) to "Resume Course" (new UJ-1 narrative and FR-4 heading) without being flagged as an intentional copy/label change.

### 1.5 Toast notification for imminent booked sessions is absent from the booking flow (see also §3.2 below)
Old §4.1 (not §4.3/§4.6, but directly booking-related): "Real-time toast alert banner triggering countdown timers when a booked tutor session starts within 60 minutes." This is a concrete, testable behavior tied to the exact feature now living in FR-10/FR-11 (booking a slot, My Booked Sessions). New PRD's UJ-1 only mentions "Confirmation toast for the booking" at the moment of booking — no mention of the pre-session countdown/reminder toast. Not addressed as in-scope, carried-over-unchanged, or explicitly deferred.

### 1.6 Analytics chart type and branding narrowed (FR-16)
Old §4.6: "**Recharts Analytics Engine**: **Bar chart** visualization for Monthly Earnings ($), Teaching Hours Logged, and Student Engagement Index."
New FR-16: "Tutor sees a **chart** (monthly earnings, teaching hours logged, student engagement index)."
The specific chart type (bar chart) and the "$" currency framing are dropped. Minor, but "a chart" is a weaker/looser requirement than "bar chart," and if the real UI has multiple/different chart types, this vagueness could mask a real regression risk during Phase B implementation validation (SM-1 "zero regressions").

### 1.7 "Public Live Masterclass" terminology is not sourced in old §4.3/§4.6 (or anywhere in FRONTEND_PRD.md)
New PRD introduces "Public Live Masterclass" as a first-class concept (Glossary, FR-13, FR-19, UJ-1, UJ-2). A full-text scan of `FRONTEND_PRD.md` finds no occurrence of "masterclass" anywhere — not in §4.3, §4.6, or elsewhere (executive summary only mentions "synchronous peer study rooms"). If this is grounded in the actual current codebase (`features/TutorHub/`) rather than the written PRD (plausible, since this PRD explicitly says capabilities "already exist" in code, not necessarily in the old doc), that should be stated explicitly as an assumption/provenance note rather than silently presented as if it were carried over from §4.3/§4.6. Currently nothing in §9 Assumptions Index covers where Masterclass came from.

---

## 2. Qualitative/tone aspects dropped in the FR-based conversion

- **Loss of product-copy voice.** Old §4.3/§4.6 read like descriptive UI copy with named, brandable widgets: "Quick Continue Banner," "Quick Book Calendar & Slots," "Recharts Analytics Engine," "Grade & Tag Strict Filtering." The new PRD systematically flattens these into generic FR titles ("Welcome banner & resume CTA," "Slot calendar management," "Performance analytics," folded/dropped filtering). This is expected for an FR-based document, but it means a reader relying only on the new PRD loses the sense of these as named, demo-able product features with specific identity/branding — worth a light pass to preserve the more evocative naming in implementation-facing docs (story titles, component names) even if FR headings stay generic.
- **Loss of "instant"/"real-time" emphasis.** Old copy repeatedly stresses immediacy: "instant local state persistence," "instant 'Continue Learning' trigger," "updating tutor state in real-time" (Online/Offline toggle). New PRD's FR-6 and FR-15 keep the capability but drop the emphatic "instant"/"real-time" language, softening what was clearly meant as a hard latency/UX expectation (feels instantaneous, no perceptible lag) into a plain functional description. Since SM-1 demands "zero regressions against current behavior," this softened language is a risk: a builder reading only the new PRD has no signal that instantaneity was a deliberate, tested UX property in the original design.
- **Marketplace/browsing tone vs. utilitarian list tone.** Old §4.3's Course Card (rating, enrolled count, instructor avatar, grade badge) reads like a course marketplace/catalog card meant to help a student *discover and evaluate* courses. New FR-8's "My Courses list" (sort options + progress bars) reads like a personal task list. This is a genuine tonal/UX shift, not just a copy simplification — see §1.1/§1.2 above where this is also flagged as a possible functional gap.
- **"Educator Dashboard" vs. "Tutor Dashboard" naming.** Old §4.6 titled the tutor-facing surface "Tutor Hub & **Educator** Dashboard." The new PRD consistently uses "Tutor Dashboard" (Glossary, §4.4/§4.5 headers). This is presumably an intentional, consistent renaming as part of the merge (the whole point is unifying naming), so likely fine — but it is a silent word choice change (Educator → Tutor) that's never called out as a rename decision, unlike other renames (e.g., FR-1's nav-tab retirement, which *is* explicitly called out).

---

## 3. Other Dashboard/Tutor Hub references elsewhere in FRONTEND_PRD.md not cross-referenced by the new PRD

### 3.1 §4.1 nav tab list and tab-count mismatch
Old §4.1: "Top Navigation Bar: Brand logo, active tab links (**Dashboard, Tutor Hub, Group Study, Assignments, Certificates**), language picker..., points counter, and student profile." That's **5** named top-level tabs in the old doc's own text.

New PRD's **SM-2**: "Nav simplified from **7** top-level tabs to **6** (Tutor Hub removed)." This 7→6 figure doesn't reconcile with the 5-tab list explicitly written in old §4.1 (which would go 5→4 if Tutor Hub is the only removal). Either:
(a) the live codebase nav has more tabs than the old written PRD documented (plausible, since this new PRD is explicitly grounded in current code, not the old doc), or
(b) the 7/6 figures need to be checked against the actual `rolePermissions`/`DEFAULT_VISIBLE_TABS` nav config referenced in FR-1.
Either way, the new PRD should state where the 7/6 count comes from (real nav config) rather than leave an unexplained mismatch with the only other written source (§4.1).

### 3.2 §4.1 "Notice & Toast Notifications" (60-minute session-start countdown)
Already flagged in §1.5 above as a missing behavior. Restating here as a cross-reference gap: this requirement lives in §4.1 (Navigation & Header), outside both §4.3 and §4.6, but is functionally a direct consequence of the booking feature that FR-9–FR-14 now own. The new PRD should either explicitly carry this forward (as a Consequence of FR-10/FR-11) or explicitly note it as an existing-but-unchanged/out-of-scope behavior, the way it did for other adjacent features (e.g., FR-14's Study Rooms quick-join, or the Offline-slot-visibility carryover in UJ-2).

### 3.3 §4.2 WCAG 2.1 Accessibility & Voice Settings Modal
This is a global, header-triggered modal (voice/TTS settings, high-contrast 7:1 mode, text sizing, screen-reader focus audio, keyboard shortcuts), not owned by Dashboard. The new PRD is entirely silent on accessibility for the newly merged Dashboard surface — no FR or Non-Goal addresses whether the high-contrast mode, text sizing, or keyboard/screen-reader navigation requirements from §4.2 apply to the new composed widgets (Weekly Goal SVG ring, stat cards, slot calendar grid, wizard modal, etc.). Given §4.2 states these are WCAG 2.1-motivated, cross-app requirements, the merged Dashboard PRD arguably should at minimum note (even briefly, e.g. in Non-Goals or an Assumption) that existing accessibility behaviors are expected to carry over unchanged to the newly composed page — the same pattern it already uses for other carried-over features (Course Creation Wizard, Study Rooms quick-join). Currently there is no such statement, so accessibility compliance for the merged layout is an unstated assumption.

### 3.4 §6 Frontend State Management — `Course[].targetGradeTag`/`tags`
Not itself a requirement, but supporting evidence for §1.1: the old state model was purpose-built with `targetGradeTag` and `tags` fields specifically to back the Grade & Tag Strict Filtering feature that FR-8 no longer mentions. Worth cross-checking whether this state shape (and the filtering it enabled) is intended to persist through the merge.

---

## Summary of highest-priority items
1. Grade-filter/search course discovery (§1.1) — likely the single largest functional gap; either restore it into FR-8 or explicitly scope it out.
2. Course Card fields — rating, enrolled count, instructor avatar (§1.2).
3. Weekly Goal Card's 5–30hr range and "instant local" persistence semantics (§1.3).
4. Booked-session 60-minute countdown toast (§1.5 / §3.2) — a specific, testable, currently-shipped behavior with no disposition in the new PRD.
5. Nav tab-count mismatch, 7→6 vs. the 5 tabs literally listed in old §4.1 (§3.1).
6. No accessibility (WCAG 2.1) carry-over statement for the newly merged Dashboard (§3.3).
