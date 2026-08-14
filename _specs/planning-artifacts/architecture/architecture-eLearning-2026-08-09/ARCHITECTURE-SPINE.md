---
name: 'FlexDemy Frontend'
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: 'feature-folder architecture with a repository (service) data-access boundary'
scope: 'FrontEnd/src -- refactor of the existing React 19 + TypeScript + Vite + Tailwind SPA into modular, reusable, component-based structure with a data-access seam ready for a future backend, plus test conventions'
status: final
created: '2026-08-09'
updated: '2026-08-13'
binds: []
sources: ['FrontEnd/docs/FRONTEND_PRD.md', 'FrontEnd/docs/BACKEND_PRD.md', '{planning_artifacts}/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md', '{planning_artifacts}/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md']
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
- **Rule:** only `src/services/*` may import `src/data/mockData.ts` or `src/lib/offlineStorage.ts`. Everything else calls a service function. Service functions are `async` and typed exactly as a future API call would be (e.g. `getCourses(): Promise<Course[]>`), even while they resolve synchronously from mock data today. A hook consuming a service exposes a consistent `{ data, isLoading, error }` shape — no feature invents its own loading/error convention. Swapping mock for a real backend later means editing `services/` only. **Refactor task (not a spine decision):** consolidate the two existing duplicate `localStorage` call sites into `services/userService.ts` / `services/coursesService.ts` as part of this work. **Extended for network calls (a fresh review caught this rule's letter only naming `mockData`/`offlineStorage`, silent on direct `fetch`):** no `features/*`, `ui/*`, `hooks/*`, or Context code may call `fetch`/`axios`/any HTTP client directly — every backend or AI-gateway call goes through a `services/*` function, same as every other persistence call this AD governs.

### AD-2 — App.tsx is a thin composition root [ASSUMPTION]

- **Binds:** `src/App.tsx`, `src/features/**`
- **Prevents:** the God-component pattern already visible today (`App.tsx` holding every feature's state and threading it down through 13 components' worth of props)
- **Rule:** `App.tsx` holds only navigation state (which feature is active) and mounts the Context providers from AD-4. Each feature owns its own *feature-local* state via a colocated hook (`use<FeatureName>.ts`) — every feature folder gets one, even a thin pass-through, so AD-5's hook-testing convention applies uniformly rather than only to features that "seem to need it." Feature-local state and rendering delegate to child components under the same folder; the top component orchestrates.

### AD-3 — Dependency direction is the target contract [ASSUMPTION]

- **Binds:** all `src/` modules
- **Prevents:** circular imports and presentational primitives silently absorbing business logic
- **Rule:** `features/*` may import `ui/*`, `hooks/*`, `services/*`, `lib/*`, `types.ts`, and the Context from AD-4. `ui/*` may import only `lib/*` and `types.ts` (primitive/generic prop shapes only) — never `features/*`, `services/*`, `hooks/*`, or the Domain Context. `services/*` may import only `lib/*` and `types.ts` — never `features/*` or `ui/*`. **Checkable `ui/` test:** a component belongs in `ui/` only if none of its props are feature-specific domain objects it fetches or mutates itself, and it imports nothing from `hooks/` or `services/`. Two components originally assumed to be primitives fail this test and are reclassified: `CourseReviewModal` (fetches/submits review data) moves to `features/CourseOverview/`, and `WeeklyGoalCard` (persists the user's weekly goal) moves to `features/Dashboard/`. **Not yet tool-enforced** — no ESLint/import-boundary linting exists in this repo today (the `lint` script is `tsc --noEmit`, type-checking only); until `eslint-plugin-boundaries` (or equivalent) is added, this rule is enforced by code review. See Deferred. **One sanctioned cross-feature exception (New Course Wizard PRD):** `CourseContentEditor`'s Review-as-Student mode imports `CoursePlayer`'s adaptive-learning components (`DrilldownPanel`, the Adaptive Ways menu, the Exercise runner, the keyword popover) directly, rather than duplicating them — these fail the `ui/` test (they fetch/mutate via `aiGatewayService.ts`), so they can't be promoted to `ui/` either. This is the only `features/*` importing `features/*` this spine permits, and it exists specifically so Review-as-Student renders byte-for-byte identical to what a real student sees (the PRD's own requirement, and AD-6's golden-file tests would otherwise have nothing shared to compare against).

### AD-4 — Shared domain state is Context-backed; only truly single-feature state is feature-local [ASSUMPTION]

- **Binds:** all application state
- **Prevents:** two failure modes — re-centralizing all state in `App.tsx`, and silently under-scoping "cross-cutting" to just auth/language/theme while the actual biggest shared-state surface (course catalog, user progress/points/streak) stays undecided. Today `CoursePlayer` writes `user.progress`/`totalPoints` and `Dashboard`, `CourseOverviewScreen`, and `ProgressAndCertificate` all read them — if each feature independently fetched/cached its own copy per AD's original narrow scope, one feature's mutation (e.g. completing a lesson) would silently not appear in another's view.
- **Rule:** any domain entity read or written by **two or more features** is cross-cutting and lives in a Context provider backed by `services/` (created at the `App.tsx` composition root): a `DomainContext` for `courses` + `user` (profile, progress, points), plus the existing scope for auth/session, active language, and accessibility settings. A domain entity touched by exactly one feature stays local to that feature's hook. No new state-management library is added (React 19 built-in `useState`/`useReducer`/`useContext` only — no redux/zustand/jotai, matching current `package.json`). **`DomainContext.courses` is published-catalog-only** — a fresh review caught this going undecided: the confirmed Chapter→Topic→Subtopic→Content-tree that `CourseContentEditor` and `CoursePlayer`'s Review-as-Student both read/write (New Course Wizard PRD) is a *second*, separate cross-cutting entity, not a variant of the catalog entry — it gets its own `CourseContentContext`, backed by `services/courseContentService.ts`, keyed by course ID. Draft/unpublished courses (still in `Draft`/`In Review`/`Review Confirmed`) live **only** in `CourseContentContext`, never in `DomainContext.courses` — `CourseDiscover` and any other published-catalog reader only ever sees `DomainContext.courses`, so an in-progress draft cannot leak into the public catalog by construction, not by convention.

### AD-5 — Test conventions [ASSUMPTION]

- **Binds:** all new and refactored code
- **Prevents:** untested business logic in services/hooks, and a parallel `__tests__` tree drifting from the source it covers
- **Rule:** `vitest` + `@testing-library/react` + `jsdom`, configured via the `test` key in the existing `vite.config.ts` (no separate test bundler) plus one `vitest.setup.ts` that registers `@testing-library/jest-dom` matchers. Tests live in a top-level `FrontEnd/tests/` tree that mirrors `src/` path-for-path (`tests/features/Dashboard/Dashboard.test.tsx` for `src/features/Dashboard/Dashboard.tsx`, `tests/services/coursesService.test.ts` for `src/services/coursesService.ts`, etc.) — **not** colocated next to source. [UPDATED — supersedes this AD's original colocation choice, per explicit user direction after the initial refactor pass; see memlog.] Because a test's relative depth to its subject no longer matches source-tree colocation, every test imports (and every `vi.mock(...)` target) its subject via the `@/src/*` alias rather than a relative path — e.g. `import { Dashboard } from '@/src/features/Dashboard/Dashboard'`, `vi.mock('@/src/services/coursesService')`. `services/` and hooks get pure-logic unit tests (no DOM); `ui/` primitives get render + interaction tests; each feature's top component gets at least one smoke test asserting it renders and its primary action calls the right service/hook. In feature/`ui/` tests, the service module is the mock boundary — never mock `data/mockData.ts` directly. `package.json` gets a `"test": "vitest"` script.

### AD-6 — Golden-file visual-regression testing via Vitest's browser mode [ASSUMPTION]

- **Binds:** math/chemistry (KaTeX+mhchem) and Hindi/Devanagari rendering parity between editor and student views (extends AD-5)
- **Prevents:** introducing Playwright Test as a second, separately-configured test runner alongside `vitest`, and recurring-cost/opaque-pricing exposure from a hosted visual-regression service (Percy/Chromatic/Applitools)
- **Rule:** Vitest 4's built-in `toMatchScreenshot()` via the `@vitest/browser-playwright` provider — MIT-licensed, no second test runner. **Not** "the same flat `vitest.config.ts` block" as AD-5 (a fresh review caught that claim as wrong: jsdom-environment tests and browser-mode tests can't share one flat `test:` block) — `vitest.config.ts` gains a `test.projects` array with two entries, one keeping AD-5's existing `environment: 'jsdom'` config untouched, one new project scoped to `tests/**/__screenshots__/**` using the `@vitest/browser-playwright` provider; both run from the same `vitest` CLI invocation and the same CI job conceptually, but CI gains one setup step (`npx playwright install --with-deps chromium`) that AD-5's jsdom-only suite never needed. `@vitest/browser-playwright` is version-locked to the exact `vitest` core version (confirmed: mismatched patch versions fail install) — pin both to the same explicit version, never `latest` on one and a range on the other. Golden-file screenshots live alongside their `FrontEnd/tests/` mirror-path tests (e.g. `tests/features/CourseContentEditor/__screenshots__/`), reviewed and updated the same way any other Vitest snapshot is (`vitest -u`). **Determinism for the exact content this AD protects:** KaTeX/mhchem and Devanagari rendering is font-load-dependent — screenshot tests wait for `document.fonts.ready` before capturing, and CI pins the same font files/versions as local dev (no system-font fallback in the CI image) to avoid cross-environment drift on the one content type most exposed to it. Chosen over Playwright Test (a full second toolchain) and hosted services (recurring cost; Applitools' pricing opacity specifically flagged as the kind of surprise this project avoids per its licensing-sensitive stance elsewhere).

### AD-7 — Correlation ID capture lives in one shared HTTP-call helper, not per-service state [ASSUMPTION]

- **Binds:** `services/*` (extends AD-1), the new `errorsService.ts` (`prd-eLearning-ErrorObservability-2026-08-13`, FR-7/FR-23)
- **Prevents:** FR-23's "hold the most recently seen Correlation ID" requirement being implemented separately — and inconsistently — per service file. Confirmed live: `services/*.ts` is inconsistent today — `courseDraftService.ts` already has a shared `write<T>()` helper that reads response bodies centrally, but `courseFileService.ts` and others still duplicate fetch logic per function. Bolting correlation-ID capture onto only the shared helper would mean calls still on the per-function pattern silently never update the retained ID — FR-23 would appear to work in some flows and silently not in others, depending on which service happened to handle a given call.
- **Rule:** a single module-level store (not React state — this value doesn't drive rendering) holds the most recently seen `X-Correlation-Id` response header value. Every `services/*` HTTP call goes through one shared low-level request helper — generalizing `courseDraftService.ts`'s `write<T>()` pattern into `services/httpClient.ts` — that reads the header and updates the store; `courseFileService.ts`'s per-function duplicated fetch logic is retired as part of implementing this feature, not left as a second, silently-noncompliant path. `errorsService.ts`'s FR-7 report call reads the store's current value into its payload when present.

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
| vitest | 4.1.10 (new — web-verified current Aug 2026, requires Vite ≥6.0.0 — satisfied) |
| @testing-library/react | ^16.3 (new — web-verified current Aug 2026, npm latest 16.3.2, confirmed React 19 support) |
| @testing-library/jest-dom | ^7 (new — latest resolves to v7, which requires Node.js ≥22; see Deferred, no Node version currently pinned in `FrontEnd/`) |
| @testing-library/user-event | ^14.6 (new — latest stable, last published ~2 years ago, no newer major exists) |
| jsdom | latest (new — DOM environment for vitest) |
| @vitest/browser-playwright | 4.1.10 (new — **pinned to the exact same version as `vitest` above, never `latest`** — this package has a strict version-locked peer dependency on vitest core; a fresh review confirmed mismatched patch versions fail install. AD-6 — web-verified Aug 2026) |

## Structural Seed

```text
FrontEnd/
  src/
    App.tsx                  # composition root only: active feature + Context providers (AD-4)
    main.tsx                 # entry point; also mounts the top-level React Error Boundary and registers window.onerror/unhandledrejection once (ErrorObservability PRD FR-6)
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
      TutorHub/                 # absorbs TutorHubView, TutorEducatorHubView, StudentTutorBookingView -- TutorEducatorHubView's old 4-step Course Creation Wizard is removed, not kept, per CourseWizard/'s note above
      ProgressAndCertificate/
      CourseWizard/              # New Course Wizard PRD: metadata side-panel steps 1-4. Fully SUPERSEDES the old 4-step wizard in TutorEducatorHubView.tsx (~950 lines, flat Module/Lesson model) per the PRD's own "replaces that flow end to end" -- does not extend it. The old wizard's code is removed as part of this feature, not left running alongside the new one.
      CourseContentEditor/       # New Course Wizard PRD: full-width Chapter->Topic->Subtopic tree editor, reads/writes CourseContentContext (AD-4). AD-6's screenshot tests live in tests/features/CourseContentEditor/__screenshots__/
      Admin/                     # existing folder (MasterDataManager, etc.), not re-enumerated here -- see the codebase; New Course Wizard PRD adds two subtabs:
        AiConfiguration/          # admin AI task provider/model/fallback/budget config + usage view -- calls services/aiConfigService.ts (backend AD-19), a DIFFERENT backend surface than aiGatewayService.ts below
        TagManagement/            # Tag CRUD (FR-26) -- calls services/tagsService.ts, net-new, not masterDataService.ts
        ErrorLog/                 # ErrorObservability PRD FR-11-FR-13/FR-24: Master-only, server-side paginated list/filter/detail/trace-view -- calls services/errorsService.ts

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
      DomainContext.tsx        # courses (published catalog only) + user (profile, progress, points, streak)
      CourseContentContext.tsx  # AD-4: the confirmed Chapter->Topic->Subtopic tree, draft AND published, backed by courseContentService.ts -- shared by CourseContentEditor and CoursePlayer's Review-as-Student mode
      SessionContext.tsx        # auth/session
      AccessibilityContext.tsx  # language + accessibility settings

    services/                 # the data-access boundary -- only layer allowed to import data/ or lib/offlineStorage.ts, or call fetch/HTTP directly (AD-1)
      httpClient.ts             # AD-7: shared low-level request helper (generalized from courseDraftService.ts's write<T>()) -- reads X-Correlation-Id off every response into the module-level store
      errorsService.ts          # ErrorObservability PRD FR-7: POST /api/v1/errors/client, reads httpClient.ts's current correlation ID into the payload
      coursesService.ts
      courseContentService.ts   # backs CourseContentContext (AD-4): the tree, per-node confirm state, extraction status
      aiConfigService.ts        # Admin AI Configuration -- calls backend AD-19, distinct from aiGatewayService.ts below
      tagsService.ts            # Tag CRUD (FR-26)
      tutorService.ts
      groupStudyService.ts
      userService.ts            # also owns progress/points persistence (consolidates today's duplicate localStorage logic)
      reviewsService.ts
      aiGatewayService.ts       # New Course Wizard PRD: calls the backend's IAiGateway endpoints (AD-14 in the backend spine) -- same async/typed-Promise shape as every other service, per AD-1

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
