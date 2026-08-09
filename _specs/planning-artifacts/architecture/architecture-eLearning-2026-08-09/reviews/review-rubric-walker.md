# Review: ARCHITECTURE-SPINE.md (LearnSphere Frontend)

Reviewer: rubric-walker (subagent)
Target: `_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md`
Verified against: `FrontEnd/src/**`, `FrontEnd/package.json`, `FrontEnd/vite.config.ts`, `FrontEnd/tsconfig.json`, `FrontEnd/docs/*.md`, live npm registry (web search).

## Verdict

Mostly sound and well-grounded in the real codebase (the ratification claims about PascalCase files, `SCREAMING_SNAKE_CASE` mock data, and the `CoursePlayer/` precedent all check out), but it has two defects serious enough to block a clean handoff: the `@/*` import alias it prescribes does not actually resolve the paths it uses as examples, and AD-3's "enforced, not just described" claim has no enforcement mechanism behind it — both will cause exactly the kind of divergence the spine exists to prevent.

## Checklist Findings

### 1. Real divergence points — fixed vs. missed

**Fixed well:**
- God-component decomposition (AD-2) — confirmed real: `App.tsx` is 397 lines, holds 14 `useState` hooks, and threads `user`, `progress`, language, etc. as props into essentially every rendered feature.
- Data-access seam (AD-1) — confirmed real: today only `App.tsx` imports `data/mockData.ts` (`INITIAL_USER`, `MOCK_COURSES`, etc.); every feature receives data via props from that one place. Funneling all reads through `services/*` is a legitimate, well-targeted rule.
- No-new-state-library (AD-4) — confirmed accurate: no redux/zustand/jotai in `package.json`.
- Test conventions (AD-5) — reasonable and necessary since the project currently has zero test tooling (no vitest, no RTL, no `test` npm script).

**Missed / under-specified — this is the most consequential gap:**

`UserProfile` (in `types.ts`) bundles `streakDays`, `totalPoints`, `language`, `preferredVoice`, `ttsRate/Pitch`, and — critically — `progress: Record<string, UserProgress>` (per-course completion state). This is genuinely cross-feature shared mutable state today: `App.tsx` passes the whole `user` object as a prop into Navbar, Dashboard, CourseOverviewScreen, CoursePlayer, AssignmentsView, GroupStudyView, ProgressAndCertificate, and TutorHubView, and `CoursePlayer` writes back into `user.progress` via `handleUpdateUser`/inline `setUser` calls that `Dashboard` and `ProgressAndCertificate` subsequently read.

AD-4 names only `auth/session, active language, accessibility settings` as Context-worthy cross-cutting state, and AD-2 says "[each feature] does not receive unrelated feature state as props." Neither AD says where course-progress/points/streak — the single largest piece of state actually shared across features in this app — is supposed to live once `App.tsx` stops holding it centrally. Two engineers implementing, say, `CoursePlayer` and `Dashboard` could reasonably diverge: one treats `progress` as feature-local (each feature re-fetches via `coursesService`/`userService` independently, risking staleness after a lesson completes) and the other assumes it rides along in the same session Context as auth. This is exactly the class of divergence the spine's altitude should resolve, and it does not. **Recommend:** either explicitly fold `progress`/`totalPoints`/`streakDays` into the cross-cutting Context AD-4 already introduces, or add a rule for how a write in one feature (`CoursePlayer` completing a lesson) becomes visible to a reader in another (`Dashboard`, `ProgressAndCertificate`) through the service layer.

Secondary, lower-stakes gap: AD-1 makes every service function `async` (returning `Promise<T>` even though it resolves synchronously today). That's a good future-proofing move, but it silently introduces loading/error states into every feature that previously read synchronous props. The spine gives no convention for how a feature-local hook should represent "loading" or "the promise rejected" (isLoading flags? throw-to-suspense? try/catch-and-toast?). Given AD-4 restricts state primitives to `useState`/`useReducer` and explicitly rules out new libraries, at minimum a one-line convention (e.g., "hooks expose `{data, isLoading, error}`") would close this off. Not blocking on its own, but it compounds the first gap.

### 2. Is every AD's Rule enforceable and does it prevent its stated divergence?

- **AD-1, AD-3 — not enforceable as written.** The repo has no ESLint config at all (`FrontEnd/package.json`'s only `lint` script is `tsc --noEmit`; there is no `.eslintrc*` / `eslint.config.*` anywhere in `FrontEnd/`). Nothing — not TypeScript, not the build, not a lint rule — stops `src/ui/Navbar.tsx` from doing `import { getCourses } from '@/services/coursesService'` or `src/features/Dashboard/Dashboard.tsx` from doing `import { MOCK_COURSES } from '@/data/mockData'`. AD-3 is explicitly titled **"Dependency direction is enforced, not just described"** and marked `[ADOPTED]`, but its Rule is pure prose — there is no lint plugin (e.g. `eslint-plugin-boundaries`, `eslint-plugin-import` with `no-restricted-paths`), no `dependency-cruiser` config, and no CI step named anywhere in the spine or the Stack table that would actually catch a violation. This is a direct self-contradiction: the AD's own name promises mechanical enforcement it does not deliver, and as written it is exactly as "just described" as AD-1. **Recommend:** either add a concrete enforcement mechanism (lint rule or `dependency-cruiser` + a CI/pre-commit check) to the Stack table, or retitle/reframe AD-3 as convention-only like the other ADs and rely on code review — but don't claim enforcement that doesn't exist.
- **AD-2, AD-4, AD-5 — enforceable in the sense that a reviewer can check them by inspection** (file structure, absence of a state library in `package.json`, colocated test files). No tooling gap here beyond the general lack of CI (see §6).

### 3. Deferred — anything that could let two units diverge now?

Reviewed each entry:
- Backend API contract — fine to defer; services are internal-only until a backend exists.
- URL-based routing — fine to defer, matches current in-memory `activeTab` state with no router dependency present.
- Auth/session persistence — fine to defer, no real auth backend exists yet.
- Dark mode — verified accurate (`App.tsx:262` hardcodes `isDarkMode={false}` regardless of `INITIAL_USER.isDarkMode`); deferring is harmless, this is unchanged behavior.
- `ui/` inventory not exhaustive — checked the 8 named `ui/` candidates (`Navbar`, `AuthModal`, `AccessibilityModal`, both toasts, `WeeklyGoalCard`, `CourseReviewModal`, `AdaptiveSchedule`) against their actual imports: all of them import only `types.ts` and/or `lib/i18n.ts`/`lib/tts.ts` today, no domain services, no sibling-feature imports. The starting placement is accurate for all 8, so deferring the rest of the inventory is safe.

None of the Deferred items look like they'd let two units diverge in a way that matters for this pass — the one real deferred-feeling gap (cross-feature progress/points state, §1 above) isn't listed under Deferred at all, which is the problem — it reads as decided (via AD-2/AD-4) when it isn't.

### 4. Named tech plausibility (Aug 2026)

Verified via live npm/web search:
- `vitest ^4.1` — accurate. Latest published version is 4.1.10 (~1 month old as of Aug 2026); a 5.0.0-beta exists but isn't GA, so pinning to `^4.1` is the correct current choice.
- `@testing-library/react ^16.3` — accurate. Latest is 16.3.2, and v16 is the first line with full React 19 peer-dependency support (14.x only declared React ^18).
- `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` listed as `"latest"` rather than a pinned range — minor inconsistency in the Stack table's own convention (every other row pins a version), but low-stakes for these packages.

No red flags here — this table is genuinely web-verified, not guessed.

### 5. Does it ratify or contradict the actual brownfield codebase?

Mostly ratifies correctly, with one concrete factual error:

- PascalCase component files — ratified correctly (`Dashboard.tsx`, `Navbar.tsx`, all of `CoursePlayer/*.tsx`).
- `SCREAMING_SNAKE_CASE` mock data — ratified correctly; every export in `data/mockData.ts` (`INITIAL_USER`, `MOCK_COURSES`, `MOCK_STUDY_ROOMS`, `MOCK_LEADERBOARD`, `MOCK_TUTOR_SLOTS`, `MOCK_GROUP_REQUESTS`, `MOCK_PUBLIC_CLASSES`) matches; zero exceptions found.
- `lib/` utility file naming (`i18n.ts`, `tts.ts`, `offlineStorage.ts`) — ratified correctly, unchanged.
- `CoursePlayer/` as the folder precedent — directionally correct (top file + colocated subcomponents: `ReaderCanvas`, `PlaybackControls`, `DrilldownPanel`, `ScratchpadPanel`, `FocusSessionTimer`, `FlashcardsModal` all present), though worth noting the *existing* `CoursePlayer.tsx` does **not** currently have a colocated hook (no `useCoursePlayer.ts` exists yet, state is inline `useState`/`useEffect`) — the spine is honest that this is new (AD-2's rule), not mis-claiming it as already-ratified, so no issue, just worth the implementer knowing the hook extraction is fresh work, not a lift-and-shift.
- **`@/*` alias — factually broken as prescribed.** The spine calls this "existing" and gives example imports `@/features/...`, `@/services/...`, `@/ui/...`. In reality:
  - `vite.config.ts`: `alias: { '@': path.resolve(__dirname, '.') }` — `__dirname` is `FrontEnd/` (where `vite.config.ts` lives), so `@` resolves to the **project root**, not `src/`.
  - `tsconfig.json`: `"paths": { "@/*": ["./*"] }`, also relative to the tsconfig's own location, i.e. `FrontEnd/`.
  - Confirmed by grep: **zero** existing files in `src/` use the `@/` alias at all today — every current import is relative (`./components/...`, `../../types`, etc.), so "existing" convention doesn't really apply to import style, only to the alias's mere presence in config.
  - Net effect: `@/features/Dashboard/Dashboard` as written in the spine does **not** resolve to `FrontEnd/src/features/Dashboard/Dashboard.tsx` — it resolves to a nonexistent `FrontEnd/features/Dashboard/Dashboard.tsx`. The correct path under the current alias config would be `@/src/features/Dashboard/Dashboard`. Every example import throughout the Consistency Conventions table and Structural Seed section is affected.
  - This is a real, mechanical defect that will cause exactly the kind of inconsistency the "no relative `../../../` chains" rule is meant to prevent: some implementers will hit the broken import, "fix" it locally by adding `/src`, others will fall back to relative imports, and the two will coexist. **Recommend:** either fix `vite.config.ts`'s alias to `path.resolve(__dirname, './src')` (and tsconfig's `paths` to `"@/*": ["./src/*"]`) as part of this refactor and say so explicitly, or correct every example in the spine to `@/src/...`.

### 6. Operational/environmental envelope (deployment, build/CI, environments)

Checked the whole repo (`FlexDemy/`) for CI config: no `.github/workflows`, no other `*.yml`/`*.yaml` CI definitions anywhere, and no deployment tooling referenced in `FrontEnd/docs/FRONTEND_PRD.md` (only `BACKEND_PRD.md` mentions deploy-adjacent concerns, out of this spine's scope). There is no existing operational envelope to ratify, contradict, or accidentally diverge from, and the spine's own scope line is explicit: `FrontEnd/src` refactor plus test conventions, not deployment. Omitting deployment/CI is the right call here, **not** a silent gap — nothing downstream needs a CI pipeline to avoid diverging, since none exists to begin with.

One small adjacent nit, not a blocker: introducing `vitest` (AD-5) implies tests need to be runnable, but `FrontEnd/package.json`'s `scripts` block has no `test` entry today (only `dev`, `build`, `preview`, `clean`, `lint`). The spine doesn't mention adding one. This is implementation-detail-sized, not architecture-sized, but flagging so it isn't dropped — "configured via the `test` key in `vite.config.ts`" is necessary but not sufficient; someone still has to add `"test": "vitest"` to `package.json` for the convention to be usable.

## Summary of Findings by Severity

| Severity | Finding |
| --- | --- |
| High | Cross-feature shared state (`UserProfile.progress`, `totalPoints`, `streakDays`) has no home under AD-2/AD-4 — real divergence risk between features that read vs. write it (§1). |
| High | `@/*` alias resolves to project root, not `src/`; every example import in the spine (`@/features/...`, `@/services/...`, `@/ui/...`) is broken as written (§5). |
| High | AD-3 claims "enforced, not just described" but has zero enforcement mechanism (no ESLint config exists at all in the repo, no import-boundary tool named) — the AD's central claim doesn't hold (§2). |
| Medium | AD-1's async service functions introduce loading/error states with no stated hook convention for representing them (§1, secondary). |
| Low | `@testing-library/jest-dom`/`user-event`/`jsdom` pinned as `"latest"` rather than a version, inconsistent with the rest of the Stack table (§4). |
| Low | No `test` npm script mentioned despite mandating vitest; minor implementation-level gap, not architecture-level (§6). |
