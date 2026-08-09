---
name: 'Adversarial Review — LearnSphere Frontend Architecture Spine'
type: review
reviews: 'architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md'
method: 'two-independent-agents, contract-only, grounded in FrontEnd/src'
created: '2026-08-09'
---

# Adversarial Review — ARCHITECTURE-SPINE.md

## Setup

The spine is the *only* shared contract between two engineers/agents who never talk to each other:

- **Engineer A** refactors `Dashboard` (and touches `WeeklyGoalCard`, `AdaptiveSchedule`, course cards, `CourseOverviewScreen`).
- **Engineer B** refactors `TutorHub` (and touches `TutorHubView`, `TutorEducatorHubView`, `StudentTutorBookingView`).

Both read AD-1 through AD-5, the Consistency Conventions table, and the Structural Seed. Both comply with every rule as literally written. The question: where do they still collide, and why doesn't the spine's own text stop it?

Every finding below is grounded in the actual code at `FrontEnd/src` as it exists today (pre-refactor) — not hypothetical code — because the existing file already contains the fault lines the two engineers will trip over independently. File:line references are given so each claim is checkable.

**Verdict up front:** the spine is directionally sound (the four-layer split and AD-3's import graph are real, enforceable, and correctly derived from `CoursePlayer/`), but it governs *placement and import direction* far more tightly than it governs *data shape, state ownership, and shared-file evolution*. Every serious collision found below happens in that second, ungoverned space — two engineers can be 100% AD-compliant and still ship a broken integration.

---

## Findings summary

| # | Severity | One-line finding |
|---|----------|-------------------|
| F1 | CRITICAL | AD-1's data-access boundary only names `data/mockData.ts`; the app's real, ubiquitous persistence mechanism (direct `localStorage` calls in 5+ components) is entirely unregulated, so engineers adopt incompatible data-access philosophies for the same class of data. |
| F2 | CRITICAL | Two components destined for two different features already read/write the *same* `localStorage` key with independently-duplicated parse/serialize logic — a live example of the "hook talks to colocated subcomponent" ambiguity the spine never resolves. |
| F3 | CRITICAL | Domain data shared by nearly every feature (`courses`, `user.progress`, `user.totalPoints`) is neither "cross-cutting" per AD-4's narrow list nor exclusively feature-local — each engineer's feature-local hook fetches/caches its own copy, so one feature's mutation silently doesn't appear in another's view. |
| F4 | HIGH | AD-1 defines the *read* shape (`getCourses(): Promise<Course[]>`) but says nothing about *mutation* shape — return value, patch-vs-whole-object, optimistic-vs-pessimistic — so structurally similar mutations across features get incompatible service signatures. |
| F5 | HIGH | AD-3's "no domain knowledge, no data fetching" test for `ui/` is undecidable, and the spine's own Structural Seed already violates it (two of its own `ui/` examples fetch/persist data and take domain-typed props) — so it sets contradictory precedent for the next borderline component. |
| F6 | HIGH | "Course card" is duplicated, unextracted, inline JSX in both `Dashboard.tsx` and `CourseDiscover.tsx` today; nothing in the spine forces the two engineers who each extract their own version to converge on one shared component or even agree on which layer it belongs in. |
| F7 | HIGH | AD-2's "owns its own state via a colocated hook" reads as mandatory, but the Structural Seed only shows hook files for 2 of 8 features — engineers diverge on whether every feature needs a `use<Feature>.ts`, breaking AD-5's hook-testing expectation inconsistently. |
| F8 | MEDIUM | `src/types.ts` has no ownership or change-process rule, and is already drifting from actual usage — two engineers independently extending it for unrelated feature needs will collide or duplicate concepts under different names. |
| F9 | MEDIUM | The `@/*` alias the spine says is "existing" and mandates for all new imports is misconfigured relative to the spine's own examples (points at project root, not `src/`) and is unused by any current import — a guaranteed shared-config collision with no assigned owner. |
| F10 | MEDIUM | AD-5 doesn't specify a mocking boundary for the mandatory feature smoke test, nor a shared vitest setup file for browser globals (`localStorage`, `navigator.onLine`) that multiple existing components already depend on — engineers pick different mocking depths and, if a setup file appears, whoever adds it first imposes unannounced global mocks on the other's tests. |

---

## F1 — AD-1's boundary regulates one data source and misses the app's real one [CRITICAL]

**Scenario.** Engineer A refactors `WeeklyGoalCard.tsx`. It currently does this directly, with no hook, no service:

```ts
// FrontEnd/src/components/WeeklyGoalCard.tsx:11-18, 23-29
const [weeklyGoalHours, setWeeklyGoalHours] = useState<number>(() => {
  const saved = localStorage.getItem(STORAGE_WEEKLY_GOAL_KEY);
  return saved ? Math.max(1, parseInt(saved, 10)) : 5;
});
...
useEffect(() => {
  localStorage.setItem(STORAGE_WEEKLY_GOAL_KEY, String(weeklyGoalHours));
}, [weeklyGoalHours]);
```

Re-reading AD-1: *"only `src/services/*` may import `src/data/mockData.ts`"*. `WeeklyGoalCard` never imports `mockData.ts`. It is 100% AD-1 compliant, literally, while doing exactly the thing AD-1 exists to prevent — a component reaching straight into a data store and bypassing the swappable seam. Engineer A, reading the rule literally, leaves it exactly as-is (or moves it into `ui/` unchanged, matching the Structural Seed's own placement of it).

Meanwhile Engineer B, building a new "recently viewed tutors" localStorage-backed feature in TutorHub, reads AD-1's *intent* ("Prevents: ... bypassing a single swappable seam") rather than its letter, and routes it through a new `tutorService.getRecentlyViewed(): Promise<TutorCalendarSlot[]>` that wraps `localStorage` internally.

Both engineers can point at AD-1 to justify opposite designs. Neither is wrong by the text. The result: half the app's persisted state goes through `services/` and is backend-swap-ready; the other half (confirmed already present at `WeeklyGoalCard.tsx:13,25`, `AdaptiveSchedule.tsx:49,81,92`, `CourseReviewModal.tsx:16,27,30`, `CourseOverviewScreen.tsx:39,50,53`, `CoursePlayer/ScratchpadPanel.tsx:128,141`, and `lib/offlineStorage.ts` itself) stays wired directly to `localStorage` and silently breaks or is forgotten when a real backend arrives — defeating AD-1's entire stated purpose.

**Why the ADs don't stop it.** AD-1's rule text is scoped to one named file (`data/mockData.ts`). It never defines "data" broadly enough to cover browser storage, and `lib/*` (which `ui/*` and everyone else may import per AD-3) already contains a data-shaped module (`offlineStorage.ts`, operating on the `UserProgress` domain type) that looks exactly like what AD-1 says only `services/` should own. The spine gives two legitimate-looking exits from the boundary it claims to enforce.

**Proposed AD.** **AD-1a — All persisted state, not just mock data, goes through the repository boundary.** Rule: any read or write of state that outlives a single render — `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or a future network call — must go through a `services/*` function, with the same async/typed-as-a-future-API-call discipline AD-1 already requires for `mockData.ts`. `lib/*` may contain *pure* storage adapters (get/set by key, no domain typing, no business rules), but any module that reads/writes a *domain type* (`UserProgress`, `CourseReview`, `ScratchpadNote`, a weekly-goal number tied to `UserProfile`) is a service, full stop, regardless of which physical store it hits today. Move `offlineStorage.ts`'s domain-typed functions out of `lib/` into `services/` (or have a service wrap it) to close the precedent gap.

---

## F2 — The same localStorage key is already independently owned by two future features [CRITICAL]

**Scenario.** `CourseOverviewScreen.tsx:35` and `CoursePlayer/ScratchpadPanel.tsx:33` each declare their own constant for the *same* key:

```
CourseOverviewScreen.tsx:35   const SCRATCHPAD_KEY = 'learnsphere_scratchpad_notes_v1';
ScratchpadPanel.tsx:33        const STORAGE_KEY     = 'learnsphere_scratchpad_notes_v1';
```

Per the Structural Seed, `CourseOverviewScreen` lands in a `CourseOverview` feature and `ScratchpadPanel` stays colocated inside `CoursePlayer`. Two different engineers, working from two different feature folders, each already have their own read/parse/write logic against this key today. Nothing in the spine says who "owns" `ScratchpadNote` data once the split happens. Under AD-2 ("each feature owns its own state via a colocated hook") each engineer's straightforward reading is: *my* feature owns *my* copy of this logic. Post-refactor, both `useCourseOverview.ts` and `useCoursePlayer.ts` (or `ScratchpadPanel.tsx` directly, per F1) independently read/write the same key with independently-evolving schemas. The moment one engineer adds a field to `ScratchpadNote` (say, a `pinned` flag) and updates only their own parse logic, the other feature's unaware read of the same key either drops the field or throws on unexpected shape — a real, silent cross-feature data corruption bug, and it will not show up in either engineer's own tests because AD-5 tests are colocated per-feature and no test exercises the shared key from both features at once.

This is also the concrete instance of "how a feature-local hook talks to a colocated subcomponent" the review was asked to probe: the codebase already contains three *different* precedents for subcomponent autonomy — `ScratchpadPanel` and `WeeklyGoalCard` fully self-manage their own persistence inside the leaf component (no hook involved at all); `FocusSessionTimer` self-manages ephemeral (non-persisted) state; and the spine's target pattern (`useDashboard.ts`, `useCoursePlayer.ts`) implies the *hook* is the single owner of feature state, with subcomponents as presentational recipients. The spine never picks one. Engineer A, cloning the `WeeklyGoalCard` precedent, lets subcomponents self-manage data. Engineer B, following AD-2's prose literally, forces the top-level hook to own everything, including modal/subcomponent-local storage, and passes it down as props. Both produce working features in isolation with incompatible internal contracts, so a subcomponent moved between features later (or a shared subcomponent like a future cross-feature notes widget) breaks either way.

**Why the ADs don't stop it.** AD-2 says a feature owns its state "via a colocated hook" but never states whether that ownership is *exclusive* (subcomponents may never read/write their own storage) or advisory. AD-3 governs *import direction*, not *data ownership* — a subcomponent self-managing `localStorage` never imports upward, so it's AD-3-legal no matter how it violates the intended single-owner-per-feature model.

**Proposed AD.** **AD-2a — Single-owner rule for feature state.** Rule: within a feature folder, the top-level `use<Feature>.ts` hook (or the top component itself, for hookless features under the AD-2b threshold below) is the *only* place that calls a `services/*` function or a storage adapter. Colocated subcomponents receive data and callbacks as props only — never call a service or touch storage directly. If two features need the same persisted domain entity (e.g. `ScratchpadNote`, keyed by course+lesson, needed by both `CourseOverview` and `CoursePlayer`), that entity gets exactly one service module (e.g. `scratchpadService.ts`) that both features' hooks call — the entity is never "owned" by a single feature folder just because one component happened to touch it first. The Structural Seed should list `scratchpadService.ts` explicitly rather than leaving `ScratchpadPanel`'s persistence implicit.

---

## F3 — No sanctioned home for cross-feature *domain* state (as opposed to cross-cutting *session* state) [CRITICAL]

**Scenario.** In current `App.tsx`, `courses` (`useState<Course[]>(MOCK_COURSES)`) and `user` (including `progress` and `totalPoints`) are single-sourced at the composition root and threaded as props into `Dashboard`, `CourseDiscover`, `CourseOverviewScreen`, `CoursePlayer`, `TutorHubView`, `AssignmentsView`, and `ProgressAndCertificate` — i.e. nearly every feature. Concretely: `TutorEducatorHubView`'s course-authoring wizard calls `onAddCourse` (`App.tsx:124-126`, `TutorHubView.tsx:16,141`) which prepends to the *same* `courses` array `Dashboard.tsx` reads; `CoursePlayer`'s `onCompleteLesson` (`App.tsx:202-232`) mutates the *same* `user.progress`/`totalPoints` that `Dashboard.tsx:102-110` derives its stats cards from.

AD-4 names exactly four things as cross-cutting Context candidates: *"auth/session, active language, accessibility settings"*. It explicitly does **not** name "the course catalog" or "a user's course progress" as cross-cutting, and its closing line is unambiguous: *"Feature-local state never lifts above its own feature folder."* Engineer A, building `useDashboard.ts`, reads this literally: `courses` isn't on the cross-cutting list, so it must be feature-local — `useDashboard.ts` calls `coursesService.getCourses()` itself and owns its own local `courses` state. Engineer B, building `useTutorHub.ts`, does exactly the same, independently, for `TutorHub`'s own copy of `courses`.

Now `TutorEducatorHubView`'s "add course" mutation updates only `TutorHub`'s local copy (via whatever service call Engineer B invented — see F4). Dashboard's separately-fetched, separately-cached copy never learns about it without a page reload. Symmetrically, completing a lesson in `CoursePlayer` doesn't move Dashboard's streak/points cards, because `UserProfile.progress`/`totalPoints` was never decided to be Context (AD-4 only names "auth/session" broadly, not the mutable progress/points fields nested inside `UserProfile`) — one engineer plausibly puts the *whole* `UserProfile` object in a `SessionContext` (since it *is* "the session user"), the other plausibly splits it, treating only identity fields as cross-cutting and treating `progress`/`totalPoints` as feature-owned, fetched independently per feature. Both readings are defensible from AD-4's four-word list; they produce incompatible state topologies that cannot be reconciled without one side rewriting the other's hook.

**Why the ADs don't stop it.** AD-4 draws the cross-cutting/feature-local line by *example*, not by *test*. "Auth/session" as an example doesn't tell you whether `UserProfile.progress` (nested inside the session object today) counts, and "feature-local state never lifts above its own feature folder" gives no answer for state that legitimately needs to be read AND mutated by 5+ features simultaneously — that's neither obviously cross-cutting UI/session state nor obviously confined to one folder. AD-1's services boundary makes it *easy* for two engineers to each independently fetch the same entity without any signal that they're duplicating a cache, because nothing says services are singletons/memoized or that entity-level state has one home.

**Proposed AD.** **AD-4a — Shared mutable domain entities get one cache, not per-feature copies.** Rule: any domain entity collection that is read by more than one feature (the qualifying test: check the Structural Seed's per-feature folder list — if two or more features need it, it qualifies) is fetched and cached in exactly one place, exposed via a small entity-store hook in `hooks/` (e.g. `hooks/useCourses.ts`, `hooks/useUserProfile.ts`) — not a new state library, still plain `useState`/`useReducer`, but explicitly *not* re-fetched or re-locally-stated per feature. This is distinct from AD-4's Context rule: entity caches are plain hooks called from each feature's hook (dependency, not Context), while Context stays reserved for truly ambient concerns (theme, locale, "who is logged in"). Concretely: `courses` and `user.progress`/`totalPoints` are entity-cache hooks; `user.id`/`name`/`role`/`language`/accessibility settings are Context. The spine must enumerate which `UserProfile` fields go where — "auth/session" is not precise enough given `UserProfile` conflates identity, accessibility prefs, and mutable progress/points in one interface today.

---

## F4 — Read shape is specified, write shape isn't [HIGH]

**Scenario.** AD-1's only worked example is a read: `getCourses(): Promise<Course[]>`. `App.tsx` today has at least seven distinct mutation handlers that will need service equivalents: `handleAddCourse` (prepend to array, no return used), `handleBookSlot` (map-and-replace by id), `handleUpdateSlot` (upsert by id, takes the *whole* updated object), `handleAddGroupRequest` (prepend), `handleJoinGroupRequest` (map-and-append into a nested array), `handleSubscribePublicClass` (toggle membership), `handleCompleteLesson` (deep-merge into nested `progress` map plus a derived points bump). Engineer B, writing `tutorService.ts` for `TutorHub`, might standardize on "mutations take a full updated entity and return `Promise<void>`, hook does the local reconciliation" (matching the existing `onUpdateSlot(updatedSlot: TutorCalendarSlot)` shape at `App.tsx:144`, `TutorHubView.tsx:19`). Engineer A, writing `coursesService.ts` for `Dashboard`/`CourseOverview` needs (e.g. completing a lesson), might standardize on "mutations take an id + patch and return `Promise<UpdatedEntity>`" so the hook doesn't need to know how to merge. Both are reasonable, idiomatic, future-API-shaped designs. Neither is wrong per AD-1. But a third feature needing *both* patterns (e.g. `ProgressAndCertificate`, which needs course completion status) now has to guess which convention its service call follows, and a code reviewer comparing `coursesService.ts` to `tutorService.ts` sees two different API philosophies with no way to tell if that's intentional.

**Why the ADs don't stop it.** AD-1 says services are "typed exactly as a future API call would be" but a future API call could just as legitimately be `PATCH /courses/:id` (partial, returns updated resource) as `PUT /slots/:id` (whole resource, returns updated resource) as `POST /group-requests/:id/join` (action, returns void) — AD-1 doesn't pick, so it doesn't actually constrain anything about mutations, only reads.

**Proposed AD.** **AD-1b — Mutation convention.** Rule: every `services/*` mutation function (a) takes an id plus a typed patch object (never the whole pre-merged entity — the *caller* doesn't get to decide the merge, the service/future-API does), and (b) returns `Promise<UpdatedEntity>` (never `void`) so the calling hook can replace its cached copy rather than needing separate optimistic-merge logic. State explicitly: "hooks never hand-roll the merge of a mutation's effect into cached state; they replace the affected entity with the service's return value." This one rule also directly resolves part of F3, since it forces a single reconciliation point per entity instead of N different local-merge implementations.

---

## F5 — `ui/`'s placement test is undecidable, and the spine's own seed contradicts it [HIGH]

**Scenario.** AD-3's prose definition of `ui/`: *"pure, reusable presentational primitives. No domain knowledge, no data fetching."* The Structural Seed then places `CourseReviewModal` and `WeeklyGoalCard` in `ui/`. Both violate the prose on inspection:

- `CourseReviewModal.tsx:5-9` takes `course: Course` — a full domain type — as a required prop, and `CourseReviewModal.tsx:12-35` exports two module-level functions (`getStoredReviewsForCourse`, `saveCourseReview`) that read/write `localStorage` directly — data fetching, by any reading of the word.
- `WeeklyGoalCard.tsx:11-18,23-29` (see F1) does the same for goal hours, plus encodes business rules (clamping 1-50, preset values, "goal achieved" thresholds) that are arguably domain logic, not presentation.

So when Engineer A and Engineer B each hit a genuinely borderline component, they have direct spine precedent for *either* answer: "components that take domain types and fetch their own data can still be `ui/`, per `CourseReviewModal`" or "no, `ui/` truly means zero data fecthing, and `CourseReviewModal`/`WeeklyGoalCard` are placement bugs in the seed I should route around by moving them to `features/` when I touch them." If Engineer A quietly "fixes" `WeeklyGoalCard`'s placement while refactoring `Dashboard` (since it's Dashboard's neighbor) and Engineer B leaves `CourseReviewModal` in `ui/` untouched (since it's not their feature), the two "reusable" components that look and behave identically end up in different layers with different import-legality — code in `TutorHub` could freely import `CourseReviewModal` (still in `ui/`, importable by everyone) but would be blocked by AD-3 from importing `WeeklyGoalCard` (now feature-local to `Dashboard`) even if a later feature legitimately wants to reuse it.

**Why the ADs don't stop it.** AD-3's test is behavioral/subjective ("no domain knowledge") rather than structural/checkable. The closing note in the Structural Seed even admits this: *"a component that turns out to carry feature-specific logic belongs in its feature folder instead, per AD-3"* — but "turns out to carry feature-specific logic" is exactly the judgment call two people will make differently, and the seed's own two examples show the judgment already went the "permissive" way once, which is precedent either engineer can cite.

**Proposed AD.** **AD-3a — Structural (not behavioral) test for `ui/` eligibility.** Rule: a component belongs in `ui/` only if, after refactor, it (a) imports nothing from `services/*` or `hooks/*` (only `lib/*` and `types.ts`, as AD-3 already says), and (b) contains zero `useEffect`/module-level code that performs I/O (storage, timers used for polling/side-effects, network). If a component fails either test, it is feature-local *regardless of how domain-typed or reusable its props look* — reusability of the *shape* of a component doesn't override the import/IO rule. Under this test, `CourseReviewModal` and `WeeklyGoalCard` are *not* `ui/`-eligible as currently written; they must either be split (a pure presentational shell in `ui/` + a feature-local or shared container that owns the service call) or moved wholesale to `features/`. Fixing the seed's own two violations before refactor starts removes the contradictory precedent.

---

## F6 — "Course card" is a live, duplicated, unassigned component [HIGH]

**Scenario.** Today, `Dashboard.tsx:333-443` inline-renders one course-card variant (thumbnail, subject/grade badges, instructor, an overall progress bar *and* a per-module progress breakdown driven by `user.progress`) and `CourseDiscover.tsx` inline-renders *two more* variants: a compact "running courses" card (`CourseDiscover.tsx:164-216`, single progress bar) and a full catalog card (`CourseDiscover.tsx:258-353`, rating/review affordance, preview-syllabus and enroll buttons, no per-module breakdown). None of the three is extracted as its own component today, and none appears in the Structural Seed's `ui/` inventory or is called out as shared. `TutorEducatorHubView` (course-authoring/analytics) will plausibly want its own course-summary card too.

Engineer A, refactoring `Dashboard`, extracts `EnrolledCourseCard.tsx` and — because it needs `user.progress` (a domain/session concept) to compute module-level completion — places it feature-local under `features/Dashboard/`, per AD-3a-style reasoning (it fails "no domain knowledge"). Engineer B, refactoring... nothing to do with course cards directly, but `StudentTutorBookingView`, needing a compact course-selector card for booking a tutor session, looks at `CourseDiscover.tsx`'s catalog card, judges it "presentational enough" (all data comes in as props, no internal service calls), and lifts a `CourseCard.tsx` into `ui/`. Now the codebase has a `ui/CourseCard.tsx` (generic-looking, reusable) and a `features/Dashboard/EnrolledCourseCard.tsx` (functionally overlapping, structurally forbidden from being imported by `TutorHub` even though it's the visually "correct" one for progress-heavy contexts) — two components solving the same design problem, permanently diverging, because the spine never assigned either the entity or a resolution process for "first feature to touch a shared-looking UI concept owns it."

**Why the ADs don't stop it.** Same root cause as F5 (undecidable `ui/` test) plus a missing "first-mover" rule: AD-3/AD-3a tell you *where* a component goes once you've decided to extract it, but nothing tells two engineers working in parallel that they're about to extract overlapping components, because there's no shared inventory or claiming mechanism — the Structural Seed is a snapshot taken once, not a living registry.

**Proposed AD.** **AD-6 — Shared-looking primitives get claimed before duplication, not after.** Rule: before extracting any new `ui/`-layer component, check the Structural Seed's `ui/` list (kept current — see below) for a pre-existing candidate covering the same visual/data pattern; if one doesn't exist and the component displays a `Course` (or another cross-feature entity) with variable data-density (progress bar optional, rating optional, action buttons variable), it must be built as one component (`ui/CourseCard.tsx`) taking an explicit `variant`/`slots` prop for the differing sections (module breakdown, rating/enroll actions, booking-select action), not three components. The Structural Seed's `ui/` table must be treated as a living document updated in the same PR that adds or moves a `ui/` component, specifically so a second engineer touching a second feature sees the first engineer's addition before duplicating it — this is a process rule the spine currently has no equivalent of (it explicitly calls itself "a starting split, not exhaustive" without saying how it gets kept in sync across parallel work).

---

## F7 — Is a colocated hook mandatory for every feature, or only for stateful ones? [HIGH]

**Scenario.** AD-2's rule: *"Each feature owns its own state via a colocated hook and does not receive unrelated feature state as props."* Read as a universal quantifier, every feature needs a `use<Feature>.ts`. But the Structural Seed only shows one explicitly for `Dashboard` (`useDashboard.ts`) and `CoursePlayer` (`useCoursePlayer.ts`); `TutorHub`, `Assignments`, `GroupStudy`, `ProgressAndCertificate`, `CourseDiscover`, `CourseOverview` show no hook file in the seed's tree.

`TutorHubView.tsx:41-44` today holds three `useState` calls directly in the top component (`perspective`, `isTutorOnline`, `displayMode`) — no hook, nothing complex, arguably "just UI state." Engineer B, refactoring `TutorHub`, has two equally-literal readings of AD-2 available: (1) AD-2 mandates a hook for *every* feature without exception, so wrap these three lines in `useTutorHub.ts` even though it adds a layer of indirection for what's currently 4 lines of code; or (2) AD-2's actual prohibition is "don't receive *unrelated* state as props from `App.tsx`" (the God-component problem it names as the thing being prevented), and inline `useState` in the top component still satisfies that — no hook required for state that's simple and never touched by a subcomponent hook-test. Engineer A, refactoring `Dashboard` (which already has meaningfully complex derived state: sort/filter/search logic at `Dashboard.tsx:44-99`), extracts a hook unambiguously, for good reason.

If Engineer B goes with reading (2), the codebase now has an inconsistent rule ("hooks exist for complex features, not simple ones") that no third engineer can infer from the spine — and it silently breaks AD-5's testing expectation, which assumes a `useDashboard.test.ts`-style file exists for "hooks" as a category get pure-logic unit tests: there is no hook to unit-test for `TutorHub`'s perspective/displayMode/online-status logic, so that logic either goes untested or gets folded into the component smoke test, which AD-5 scopes differently ("renders and its primary action calls the right service/hook" — a much thinner bar than a hook's dedicated logic tests).

**Why the ADs don't stop it.** AD-2 states the rule and the Structural Seed illustrates it inconsistently (2 of 8 features shown with hooks), so the seed itself is the ambiguity's source — a reader can't tell if the omission for the other 6 features means "hook still required, just not spelled out in this diagram" or "hook only needed where shown."

**Proposed AD.** **AD-2b — Hook-extraction threshold, stated explicitly.** Rule: every feature's top component gets a colocated `use<Feature>.ts` if it has more than one piece of `useState`/`useReducer` state **or** calls any `services/*` function **or** computes derived data (filter/sort/aggregate) from props. A feature whose top component has exactly zero or one trivial UI-only state variable and no service calls may keep it inline — but must say so with a one-line comment (`// intentionally no useTutorHub.ts — state is UI-only, see AD-2b`) so the omission reads as a decision, not an oversight, and reviewers/other engineers don't "fix" it inconsistently later. Update the Structural Seed to show a hook file (or the explicit inline-exception comment) for all 8 features, not just 2, so it stops reading as a partial example.

---

## F8 — `src/types.ts` is a shared file with no ownership rule, and is already drifting [MEDIUM]

**Scenario.** `Dashboard.tsx:74-75` reads `progA?.lastAccessedAt` and `Dashboard.tsx:279` reads `user.weeklyGoalHours` — neither field exists on `UserProgress` or `UserProfile` in `types.ts` today (verified: `grep -n "weeklyGoalHours\|lastAccessedAt" src/types.ts` returns nothing). This is a live type-drift bug that predates the refactor. Under the feature-folder split, Engineer A fixes it while building `useDashboard.ts` — adding `lastAccessedAt: string` to `UserProgress` and `weeklyGoalHours: number` to `UserProfile` in the *shared* `types.ts`. Independently, Engineer B, building a "recently booked tutors" feature for `TutorHub`, needs a similar "what did the user last interact with" concept and — unaware of Engineer A's in-flight change to the same shared file — adds their own field, e.g. `UserProfile.recentTutorIds: string[]`, modeling "recency" a third, structurally different way. Both edits land in the same file; at best it's a merge conflict, at worst (if they don't conflict textually, e.g. touching different interfaces) it's two incompatible "recency" models sitting side by side in the same shared type file, with no rule that would have made either engineer check for the other's overlapping concept first.

Separately, this also collides with the Consistency Conventions table's own statement that *"feature-local types stay inside the feature folder"* — `weeklyGoalHours` is arguably Dashboard-specific (nothing else uses it) and `recentTutorIds` is arguably TutorHub-specific, so neither obviously belongs in the shared file at all, yet `UserProfile` is where both engineers will reach for it because it's the existing, natural, already-imported home for "stuff about the user."

**Why the ADs don't stop it.** No AD addresses `types.ts` change ownership, and the "feature-local types stay in the feature folder" convention gives no test for *when a field on a shared type is actually feature-local content masquerading as shared*.

**Proposed AD.** **AD-7 — `types.ts` additions require a "used by 2+ features" check, and a lightweight claim step.** Rule: a field is added to a shared interface in `types.ts` only if at least two features already need it (the same bar as AD-4a's entity-cache test); a field needed by exactly one feature goes in that feature's local types file (e.g. `features/Dashboard/types.ts`) even if it's *conceptually* attached to `UserProfile` — model it as a keyed lookup the feature owns (`Record<userId, DashboardPrefs>`) rather than widening the shared interface. Before widening a shared interface, grep the field name and its obvious synonyms across `src/` (exactly the check this review just did to find the collision) — cheap, mechanical, and catches exactly this class of duplicate-concept collision before it's committed.

---

## F9 — The `@/*` alias the spine assumes to be working is misconfigured and unused [MEDIUM]

**Scenario.** The Consistency Conventions table says imports should be *"Absolute via existing `@/*` alias (`@/features/...`, `@/services/...`, `@/ui/...`) ... reuses the current `@/*` alias — no separate test bundler"* (also referenced in AD-5). Checking `vite.config.ts`:

```ts
resolve: {
  alias: { '@': path.resolve(__dirname, '.') },
},
```

`__dirname` here is `FrontEnd/`, not `FrontEnd/src/`. So `@` currently resolves to the *project root*, and `@/features/Dashboard/Dashboard` would resolve to `FrontEnd/features/Dashboard/Dashboard` — a path that will never exist under the spine's own Structural Seed (everything lives under `FrontEnd/src/`). Confirmed by grep: zero existing files in `src/` use the `@/` alias at all (`grep -rn "from '@/" src` → 0 results) — it has never been exercised, so this misconfiguration has never surfaced as a build error.

Engineer A and Engineer B will each hit this independently on day one, the first time either writes `import { X } from '@/services/coursesService'`. Two equally-plausible, uncoordinated fixes: (a) repoint the alias to `path.resolve(__dirname, './src')` in the shared `vite.config.ts` — which silently changes the resolution of the *other* engineer's already-written `@/`-prefixed imports mid-flight if they pull the change; or (b) leave the config alone and route around it by writing `@/src/features/...` in just their own feature's files, producing a codebase where half the imports say `@/features/...` and half say `@/src/features/...`, both resolving correctly under different fixes that were never reconciled. `vite.config.ts` is also the exact file AD-5 says needs a new `test` key added for vitest — a second, concurrent reason both engineers touch the same shared config file with no stated precedence or ownership.

**Why the ADs don't stop it.** The spine describes the alias as "existing" (true only for the config entry, not for any working example) and assigns no owner to shared build/test config. AD-5 compounds this by directing a *second* unowned edit to the same file.

**Proposed AD.** **AD-8 — Shared config files are fixed once, before feature work starts, not discovered mid-refactor.** Rule: as a zero-th step of this refactor (not delegated to whichever engineer hits it first), `vite.config.ts` is updated in one commit to (a) point `@` at `./src` and (b) add the vitest `test` key AD-5 requires, including `setupFiles` (see F10). Neither Engineer A nor Engineer B may modify `vite.config.ts` as part of their feature work; if a feature genuinely needs a config change, it's flagged and merged separately, sequentially, not assumed pre-existing.

---

## F10 — No mocking-boundary convention for the mandated smoke test, no shared test-setup file [MEDIUM]

**Scenario.** AD-5 requires *"each feature's top component gets at least one smoke test asserting it renders and its primary action calls the right service/hook."* It doesn't say *how* — at the service boundary or the hook boundary. Engineer A writes `Dashboard.test.tsx` that does `vi.mock('./useDashboard')`, supplies a canned return value, and asserts the "Resume Course" button calls the mocked hook's handler — never exercising the real hook. Engineer B writes `TutorHubView.test.tsx` that leaves the real `useTutorHub` (or, per F7, the real inline `useState`s) running and mocks only `tutorService.bookSlot` at the service layer, so the real state-transition logic executes in the test. Both satisfy AD-5's one sentence. But they establish incompatible test idioms: Engineer A's approach means hook logic bugs never surface in the component test (by design — it's a pure interaction test), Engineer B's means the component test is effectively also a hook integration test with real state transitions, which is more brittle to hook refactors. A third engineer copying "the test pattern" from whichever file they open first inherits a different contract than the spine's one sentence actually promises.

Separately: several existing components read browser globals directly in ways jsdom needs polyfilled or explicitly mocked to test at all — `navigator.onLine` (`OfflineProgressToast.tsx:9`), `localStorage` (six components per F1/F2), `setInterval`-driven countdowns (`AppointmentToast.tsx:29-34`, `FocusSessionTimer`). AD-5 names the test stack (`vitest` + RTL + `jsdom`) and where config lives (`vite.config.ts`'s `test` key) but never mentions a `setupFiles` entry. If Engineer A is first to need `@testing-library/jest-dom` matchers (`toBeInTheDocument()`, etc.) and adds `import '@testing-library/jest-dom'` locally to their own test files, while Engineer B, hitting the same need later, discovers a shared `setupFiles: ['./vitest.setup.ts']` doesn't exist and creates one — now every test file written before that point (including Engineer A's) is silently relying on a per-file import that becomes redundant-but-harmless, while every test written after implicitly depends on global setup the original engineer never knew was coming, including possibly a global `localStorage` mock that changes the *behavior*, not just the matchers, of Engineer A's already-passing `WeeklyGoalCard` tests.

**Why the ADs don't stop it.** AD-5 specifies the stack and file-naming convention exhaustively but is silent on (a) mocking boundary/depth and (b) global test setup — both of which materially change what a "passing test suite" means across two independently-written feature test suites.

**Proposed AD.** **AD-5a — Mocking boundary and shared setup, stated once.** Rule: (1) a feature's top-component smoke test mocks at the **service** boundary only (never the feature's own hook) — this is the one convention both engineers must follow, so every smoke test exercises real hook logic and only fakes the eventual network/storage call, giving the suite actual regression value on state-transition bugs, not just render-and-click theater. (2) One `vitest.setup.ts`, created in the same zero-th commit as AD-8's `vite.config.ts` fix, registers `@testing-library/jest-dom` and any browser-global polyfills/mocks needed app-wide (a stubbed `localStorage`, `navigator.onLine` defaulted true) — declared upfront, in the spine or in the setup file's own header comment, so neither engineer is surprised by global state their tests didn't opt into.

---

## Closing note

None of these ten findings require rejecting the spine's core paradigm — the four-layer split and AD-3's import graph are worth keeping. What's missing is a second tier of rules governing *the things two isolated engineers actually disagree about in practice*: what counts as "data" (F1), who owns state that's neither obviously cross-cutting nor obviously single-feature (F3), what a mutation's contract looks like (F4), a checkable (not prose) test for `ui/` placement (F5, F6), whether hook-extraction is mandatory (F7), how shared files evolve without collision (F8, F9), and what a test actually promises (F10). All are stated above as concrete, addable ADs (AD-1a/1b, AD-2a/2b, AD-3a, AD-4a, AD-5a, AD-6, AD-7, AD-8) sized to slot into the existing spine format without restructuring it.
