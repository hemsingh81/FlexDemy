---
name: 'FlexDemy Frontend'
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: 'feature-folder architecture with a repository (service) data-access boundary'
scope: 'FrontEnd/src -- refactor of the existing React 19 + TypeScript + Vite + Tailwind SPA into modular, reusable, component-based structure with a data-access seam ready for a future backend, plus test conventions'
status: final
created: '2026-08-09'
updated: '2026-08-09'
binds: []
sources: ['FrontEnd/docs/FRONTEND_PRD.md', 'FrontEnd/docs/BACKEND_PRD.md']
companions: []
---

# Architecture Spine — FlexDemy Frontend

## Design Paradigm

**Feature-folder architecture with a repository (service) boundary.**

```mermaid
flowchart LR
  App[App.tsx — composition root] --> Features[features/*]
  App --> Domain["DomainContext — shared entities (courses, user/progress)"]
  Features --> Domain
  Features --> UI[ui/*]
  Features --> Hooks[hooks/* + feature-local hooks]
  Features --> Services[services/*]
  Hooks --> Services
  Domain --> Services
  Services --> Persist["data/mockData.ts (today) → API client (later)"]
  Services --> OfflineLib["lib/offlineStorage.ts"]
  UI --> Lib[lib/*]
```

Four layers, one direction of dependency (bottom of the diagram never imports upward):

- **features/** — composed, stateful. One folder per product surface (Dashboard, CourseDiscover, CourseOverview, CoursePlayer, Assignments, GroupStudy, TutorHub, ProgressAndCertificate). Owns its own feature-local state and subcomponents.
- **ui/** — pure, reusable presentational primitives. No domain knowledge, no data fetching (see AD-3 for the checkable test).
- **hooks/** — cross-feature shared hooks (e.g. `useAccessibilitySettings`, `useOfflineSync`). Feature-local hooks live inside their own feature folder instead.
- **services/** — the data-access boundary. Every read/write of domain data *and* every persistence call (including `localStorage`) goes through here.
- **lib/** — framework- and domain-agnostic utilities (unchanged: `i18n.ts`, `tts.ts`, `offlineStorage.ts`), only ever called from `services/`.

This generalizes the one convention already present in the codebase (`src/components/CoursePlayer/`, a top file + colocated subcomponents) rather than inventing a new pattern.

## Invariants & Rules

### AD-1 — Repository boundary is the only path to data or persistence [ASSUMPTION]

- **Binds:** all data reads/writes and all persistence (mock data today, `localStorage`, and a future API) across the app
- **Prevents:** features or components reaching straight into `data/mockData.ts` or calling `lib/offlineStorage.ts` / raw `localStorage` directly and bypassing a single swappable seam. This is a real, existing bug today: `CourseOverviewScreen.tsx` and `CoursePlayer/ScratchpadPanel.tsx` each independently duplicate `localStorage` read/write logic against the same key.
- **Rule:** only `src/services/*` may import `src/data/mockData.ts` or `src/lib/offlineStorage.ts`. Everything else calls a service function. Service functions are `async` and typed exactly as a future API call would be (e.g. `getCourses(): Promise<Course[]>`), even while they resolve synchronously from mock data today. A hook consuming a service exposes a consistent `{ data, isLoading, error }` shape — no feature invents its own loading/error convention. Swapping mock for a real backend later means editing `services/` only. **Refactor task (not a spine decision):** consolidate the two existing duplicate `localStorage` call sites into `services/userService.ts` / `services/coursesService.ts` as part of this work.

### AD-2 — App.tsx is a thin composition root [ASSUMPTION]

- **Binds:** `src/App.tsx`, `src/features/**`
- **Prevents:** the God-component pattern already visible today (`App.tsx` holding every feature's state and threading it down through 13 components' worth of props)
- **Rule:** `App.tsx` holds only navigation state (which feature is active) and mounts the Context providers from AD-4. Each feature owns its own *feature-local* state via a colocated hook (`use<FeatureName>.ts`) — every feature folder gets one, even a thin pass-through, so AD-5's hook-testing convention applies uniformly rather than only to features that "seem to need it." Feature-local state and rendering delegate to child components under the same folder; the top component orchestrates.

### AD-3 — Dependency direction is the target contract [ASSUMPTION]

- **Binds:** all `src/` modules
- **Prevents:** circular imports and presentational primitives silently absorbing business logic
- **Rule:** `features/*` may import `ui/*`, `hooks/*`, `services/*`, `lib/*`, `types.ts`, and the Context from AD-4. `ui/*` may import only `lib/*` and `types.ts` (primitive/generic prop shapes only) — never `features/*`, `services/*`, `hooks/*`, or the Domain Context. `services/*` may import only `lib/*` and `types.ts` — never `features/*` or `ui/*`. **Checkable `ui/` test:** a component belongs in `ui/` only if none of its props are feature-specific domain objects it fetches or mutates itself, and it imports nothing from `hooks/` or `services/`. Two components originally assumed to be primitives fail this test and are reclassified: `CourseReviewModal` (fetches/submits review data) moves to `features/CourseOverview/`, and `WeeklyGoalCard` (persists the user's weekly goal) moves to `features/Dashboard/`. **Not yet tool-enforced** — no ESLint/import-boundary linting exists in this repo today (the `lint` script is `tsc --noEmit`, type-checking only); until `eslint-plugin-boundaries` (or equivalent) is added, this rule is enforced by code review. See Deferred.

### AD-4 — Shared domain state is Context-backed; only truly single-feature state is feature-local [ASSUMPTION]

- **Binds:** all application state
- **Prevents:** two failure modes — re-centralizing all state in `App.tsx`, and silently under-scoping "cross-cutting" to just auth/language/theme while the actual biggest shared-state surface (course catalog, user progress/points/streak) stays undecided. Today `CoursePlayer` writes `user.progress`/`totalPoints` and `Dashboard`, `CourseOverviewScreen`, and `ProgressAndCertificate` all read them — if each feature independently fetched/cached its own copy per AD's original narrow scope, one feature's mutation (e.g. completing a lesson) would silently not appear in another's view.
- **Rule:** any domain entity read or written by **two or more features** is cross-cutting and lives in a Context provider backed by `services/` (created at the `App.tsx` composition root): a `DomainContext` for `courses` + `user` (profile, progress, points), plus the existing scope for auth/session, active language, and accessibility settings. A domain entity touched by exactly one feature stays local to that feature's hook. No new state-management library is added (React 19 built-in `useState`/`useReducer`/`useContext` only — no redux/zustand/jotai, matching current `package.json`).

### AD-5 — Test conventions [ASSUMPTION]

- **Binds:** all new and refactored code
- **Prevents:** untested business logic in services/hooks, and a parallel `__tests__` tree drifting from the source it covers
- **Rule:** `vitest` + `@testing-library/react` + `jsdom`, configured via the `test` key in the existing `vite.config.ts` (no separate test bundler) plus one `vitest.setup.ts` that registers `@testing-library/jest-dom` matchers. Tests live in a top-level `FrontEnd/tests/` tree that mirrors `src/` path-for-path (`tests/features/Dashboard/Dashboard.test.tsx` for `src/features/Dashboard/Dashboard.tsx`, `tests/services/coursesService.test.ts` for `src/services/coursesService.ts`, etc.) — **not** colocated next to source. [UPDATED — supersedes this AD's original colocation choice, per explicit user direction after the initial refactor pass; see memlog.] Because a test's relative depth to its subject no longer matches source-tree colocation, every test imports (and every `vi.mock(...)` target) its subject via the `@/src/*` alias rather than a relative path — e.g. `import { Dashboard } from '@/src/features/Dashboard/Dashboard'`, `vi.mock('@/src/services/coursesService')`. `services/` and hooks get pure-logic unit tests (no DOM); `ui/` primitives get render + interaction tests; each feature's top component gets at least one smoke test asserting it renders and its primary action calls the right service/hook. In feature/`ui/` tests, the service module is the mock boundary — never mock `data/mockData.ts` directly. `package.json` gets a `"test": "vitest"` script.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Component files | `PascalCase.tsx`, one component per file (ratified — matches existing `Dashboard.tsx`, `Navbar.tsx`, etc.) |
| Feature folders | `PascalCase/` under `src/features/` (ratified — matches existing `CoursePlayer/`) |
| Hooks | `camelCase.ts` starting with `use` (e.g. `useCourses.ts`); feature-local hooks live inside their feature folder |
| Services | `camelCase.ts` ending in `Service` (e.g. `coursesService.ts`), one module per domain entity |
| Utility/lib files | `camelCase.ts` (ratified — matches existing `offlineStorage.ts`, `i18n.ts`, `tts.ts`) |
| Mock/constant data | `SCREAMING_SNAKE_CASE` exports (ratified — matches existing `MOCK_COURSES`, `INITIAL_USER`) |
| Shared domain types | `src/types.ts`. A type used by 2+ features stays here; a type used by exactly one feature may move into that feature folder; an already-shared type is never fragmented back out. |
| Imports | Absolute via `@/src/*` (**new convention** — the existing `@/*` alias in `tsconfig.json`/`vite.config.ts` resolves to the project root, i.e. `FrontEnd/`, not `src/`, and has zero current usages; `@/src/features/...` etc. is correct against that existing alias) — no relative `../../../` chains across layers |
| Styling | Tailwind utility classes inline (unchanged, no CSS modules / styled-components introduced) |
| Tests | `FrontEnd/tests/` mirrors `src/` path-for-path (not colocated), imports via `@/src/*`, `vitest` + `@testing-library/react`, service-level mocking |

## Stack

| Name | Version |
| --- | --- |
| react / react-dom | ^19.0.1 (unchanged, inherited) |
| typescript | ~5.8.2 (unchanged, inherited — see Deferred: 2 majors behind current npm latest, out of scope here) |
| vite | ^6.2.3 (unchanged, inherited — see Deferred: 2 majors behind current npm latest, out of scope here) |
| tailwindcss | ^4.1.14 (unchanged, inherited) |
| vitest | ^4.1 (new — web-verified current Aug 2026, npm latest 4.1.10, requires Vite ≥6.0.0 — satisfied) |
| @testing-library/react | ^16.3 (new — web-verified current Aug 2026, npm latest 16.3.2, confirmed React 19 support) |
| @testing-library/jest-dom | ^7 (new — latest resolves to v7, which requires Node.js ≥22; see Deferred, no Node version currently pinned in `FrontEnd/`) |
| @testing-library/user-event | ^14.6 (new — latest stable, last published ~2 years ago, no newer major exists) |
| jsdom | latest (new — DOM environment for vitest) |

## Structural Seed

```text
FrontEnd/
  src/
    App.tsx                  # composition root only: active feature + Context providers (AD-4)
    main.tsx                 # unchanged entry point
    types.ts                 # unchanged: shared domain types

    features/                # one folder per product surface -- EVERY feature gets this shape (AD-2)
      Dashboard/
        Dashboard.tsx          # feature top component (orchestrates)
        useDashboard.ts        # feature-local state/data-shaping hook
        WeeklyGoalCard.tsx     # moved here from ui/ (AD-3): persists data, not a pure primitive
        *.tsx                  # other feature-local subcomponents
      CourseDiscover/
      CourseOverview/
        CourseOverviewScreen.tsx
        useCourseOverview.ts
        CourseReviewModal.tsx  # moved here from ui/ (AD-3): fetches/submits review data
      CoursePlayer/            # existing folder, ratified as the pattern every other feature replicates
        CoursePlayer.tsx
        useCoursePlayer.ts
        DrilldownPanel.tsx
        FlashcardsModal.tsx
        FocusSessionTimer.tsx
        PlaybackControls.tsx
        ReaderCanvas.tsx
        ScratchpadPanel.tsx     # localStorage calls move into services/ per AD-1
      Assignments/
      GroupStudy/
      TutorHub/                 # absorbs TutorHubView, TutorEducatorHubView, StudentTutorBookingView
      ProgressAndCertificate/

    ui/                       # pure reusable presentational primitives (AD-3's checkable test)
      Navbar.tsx
      AuthModal.tsx
      AccessibilityModal.tsx
      AppointmentToast.tsx
      OfflineProgressToast.tsx
      AdaptiveSchedule.tsx

    hooks/                    # cross-feature shared hooks only
      useAccessibilitySettings.ts
      useOfflineSync.ts

    context/                  # AD-4: Context providers for cross-cutting/shared-domain state
      DomainContext.tsx        # courses + user (profile, progress, points, streak)
      SessionContext.tsx        # auth/session
      AccessibilityContext.tsx  # language + accessibility settings

    services/                 # the data-access boundary -- only layer allowed to import data/ or lib/offlineStorage.ts
      coursesService.ts
      tutorService.ts
      groupStudyService.ts
      userService.ts            # also owns progress/points persistence (consolidates today's duplicate localStorage logic)
      reviewsService.ts

    data/
      mockData.ts              # unchanged content; import access now restricted to services/

    lib/                      # unchanged: framework-agnostic utilities, called only from services/
      i18n.ts
      tts.ts
      offlineStorage.ts

    vitest.setup.ts            # AD-5: registers @testing-library/jest-dom matchers

  tests/                      # AD-5 [UPDATED]: mirrors src/ path-for-path, not colocated
    features/
      Dashboard/
        Dashboard.test.tsx
        useDashboard.test.ts
      CourseOverview/
      CoursePlayer/
      TutorHub/
      ...                      # one subfolder per src/features/* entry, same file-per-file mirroring
    ui/
    services/
    context/
```

`ui/` above is the corrected, checked-against-AD-3 split (two components moved out after the reviewer gate caught them contradicting the rule). It's a starting placement, not a locked inventory — apply the AD-3 test to any component that still looks borderline during the refactor.

## Deferred

- **Backend API contract** (endpoints, auth, error envelope) — `BACKEND_PRD.md` exists but wasn't reviewed as part of this run. `services/` functions are shaped to make the swap mechanical, but the actual contract is a separate decision when backend integration is scoped.
- **URL-based routing** — `App.tsx` uses in-memory `activeTab` state today, no router in `package.json`. Left as-is; introducing a router (deep-linking, SSR posture) is a bigger call for when backend integration is actually scoped.
- **Auth/session persistence strategy** — `AuthModal` + `UserProfile` exist but there's no real auth backend yet. `SessionContext` is a placeholder shape, not a security design.
- **Dark mode** — `UserProfile.isDarkMode` exists in the type but `App.tsx` force-disables it today. Left exactly as current behavior; out of scope for this pass.
- **Automated import-boundary enforcement** — AD-3's dependency direction is a code-review convention today, not tool-enforced. Revisit by adding `eslint-plugin-boundaries` (or equivalent) once the refactor lands, so the rule stops depending on reviewer vigilance.
- **Framework majors (Vite, TypeScript)** — both inherited versions are now ~2 majors behind current npm latest. Upgrading them is a separate initiative from this component-architecture refactor; revisit if/when that's explicitly scoped.
- **`@testing-library/jest-dom` Node requirement** — latest (v7) requires Node.js ≥22, and no Node version is pinned anywhere in `FrontEnd/` (no `engines`, no `.nvmrc`). Revisit if a CI pipeline or a contributor's local Node version turns out to be below 22.
