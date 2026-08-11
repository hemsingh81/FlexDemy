---
name: 'Reviewer Gate — Rubric Walk: New Course Wizard additions to ARCHITECTURE-SPINE.md (AD-6 + Structural Seed)'
type: review
target: '_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md'
method: 'Good-spine checklist walked against AD-6 and the new Structural Seed entries (CourseWizard/, CourseContentEditor/, Admin/AiConfiguration/, Admin/TagManagement/, services/aiGatewayService.ts), cross-checked against the driving PRD (prd-eLearning-CourseWizard-2026-08-10/prd.md), the live FrontEnd/src tree, and independent web verification of AD-6s named tech.'
created: '2026-08-11'
---

# Reviewer Gate — Rubric Walk: New Course Wizard Additions

## Verdict

AD-6's chosen tech (`vitest` 4's `toMatchScreenshot()` via `@vitest/browser-playwright`) is real, current, and correctly characterized, but the update as a whole does not yet integrate cleanly: the `CourseWizard/` seed entry textually contradicts its own driving PRD's explicit "fully supersedes" non-goal, two new Admin subtabs are given no named service despite AD-1's boundary rule, and AD-6's rule text glosses over a genuine Vitest config-structure conflict and an untreated screenshot-determinism risk that lands squarely on the exact content (Hindi/Devanagari, KaTeX+mhchem) it exists to protect.

Two sibling reviews (`review-adversarial-coursewizard.md`, `review-versions-coursewizard.md`) already ran on this same update; where this walk's findings overlap theirs I've noted it and kept my entry brief — the items below not cross-referenced are not covered by either.

## Findings

### CRITICAL

**1. `CourseWizard/`'s seed comment contradicts the PRD it's sourced from — "extends" vs. the PRD's explicit "fully supersedes."**

- **Where:** `ARCHITECTURE-SPINE.md` line 148 — `CourseWizard/  # New Course Wizard PRD: metadata side-panel steps 1-4 (extends TutorHub's existing wizard shell)`.
- **What's wrong:** The driving PRD is unambiguous and says the opposite twice. §0: "This document ... **supersedes** `prd-eLearning-2026-08-10` ... FR-18, which described the existing 4-step Course Creation Wizard prototype (`FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx`) ... This document replaces that flow end to end." §5 Non-Goals: "This PRD does not patch or extend Dashboard PRD's FR-18's 4-step shell — it fully supersedes that flow." I read the actual code at `FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx` (lines 73–90, 325–1016): it's a self-contained, ~950-line `SidePanel` modal with local `wizardStep`/form-value state and a flat Title→Assets→Lessons→Review sequence — no AI extraction, no Chapter/Topic/Subtopic tree, no colocated hook, no service calls. The new wizard's data model (metadata steps 1-4 feeding a separate full-width `CourseContentEditor/` tree, AI-extracted structure, per-node confirmation) is fundamentally different, not additive. "Extends" tells an implementer to reuse/wire into this existing component; the PRD says to replace it and is explicit that patching it is a non-goal.
- **Why it matters:** This is exactly the kind of real divergence point a spine exists to close, not open. One implementer reading only the spine could literally add wizard steps 5+ onto `TutorEducatorHubView.tsx`'s existing `wizardStep` state machine; another reading only the PRD builds `CourseWizard/` from scratch and never touches the old file. The spine is also silent on what happens to the now-dead ~950 lines in `TutorEducatorHubView.tsx` — neither "delete this" nor "deprecate this" is stated anywhere in the Structural Seed or Deferred.
- **Fix:** Reword line 148 to something like `CourseWizard/  # New Course Wizard PRD: metadata side-panel steps 1-4 — REPLACES TutorHub's existing 4-step wizard shell (Dashboard PRD FR-18 fully superseded per PRD §0/§5, not extended); old wizardStep state/JSX in TutorEducatorHubView.tsx is deleted as part of this feature landing.` If only the `SidePanel` *UI pattern* (not the code or data model) is meant to carry over, say that explicitly instead of "extends."

### HIGH

**2. `Admin/AiConfiguration/` and `Admin/TagManagement/` are given no named frontend service, despite AD-1's rule that only `services/*` may reach data/backend.**

- **Where:** Structural Seed lines 150–152 (`Admin/AiConfiguration/  # ... calls backend AD-19`, `Admin/TagManagement/  # Tag CRUD (FR-26)`) vs. `services/` lines 172–177, which adds exactly one new module: `aiGatewayService.ts`, explicitly scoped to "the backend's `IAiGateway` endpoints (AD-14 in the backend spine)."
- **What's wrong:** The backend spine treats AI Task *invocation* (`IAiGateway`, AD-14) and AI Task *configuration CRUD* (`IAiConfigService`/`AiConfigController`, AD-19) as two different Application-layer surfaces on purpose (confirmed by reading `architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md` AD-14 and AD-19). `Admin/AiConfiguration/`'s own comment says it "calls backend AD-19" — a different controller than the one `aiGatewayService.ts` is scoped to — yet no `aiConfigService.ts` (or equivalent) is seeded. Tags fare worse: the PRD is explicit (FR-26) that "`Course.tags` today is a plain string array with no master-data backing, and `MasterDataManager` is a taxonomy-specific system, not a generic master-data framework — FR-26 is not a plug-in to that existing scaffold" — i.e., the PRD pre-emptively warns against folding Tag CRUD into `masterDataService.ts`, but the seed names no alternative home either.
- **Why it matters:** AD-1's rule ("everything else calls a service function") and the Consistency Conventions table's "one module per domain entity" are both real, but neither pins a *name* or *location* for these two new backend surfaces. Two implementers can each honestly satisfy AD-1's letter while landing in different places — one adds `aiConfigService.ts`, another bolts AI-config calls onto `aiGatewayService.ts` since it's "AI-shaped"; one adds `tagsService.ts`, another stuffs Tag CRUD into `masterDataService.ts` despite the PRD's explicit warning not to.
- **Fix:** Add two lines to the `services/` seed: `aiConfigService.ts  # Admin AI task provider/model/fallback/budget CRUD + usage view — calls backend AD-19 (distinct from aiGatewayService.ts's AD-14 task-invocation surface)` and `tagsService.ts  # Tag CRUD (FR-26) — net-new, not folded into masterDataService.ts per the PRD's explicit non-plug-in note`.

**3. AD-6's "same `vitest.config.ts`" claim skips the real config-structure conflict between AD-5's jsdom suite and AD-6's browser-mode suite.**

- **Where:** AD-6 rule text, line 83: "same `vitest.config.ts`, same CI job as AD-5's existing suite, no second runner." Live config at `FrontEnd/vite.config.ts` lines 21–25: a single flat `test: { environment: 'jsdom', globals: true, setupFiles: [...] }` block.
- **What's wrong:** I independently verified (Vitest docs/discussions on mixing environments) that Vitest does not let a single flat `test` block run some files under `environment: 'jsdom'` and others under `test.browser.enabled: true` in the same pass — that requires `test.projects` (workspace-style sub-configs), one project per environment. AD-6's rule text says "same `vitest.config.ts`" as if this is a non-issue, but the *current* config is exactly the flat shape that can't host both. An implementer following AD-6 literally — enabling `test.browser.enabled: true` in the existing flat `test` block to satisfy "same config file" — would flip AD-5's entire existing jsdom suite into browser mode (or break it outright), not add a scoped screenshot suite alongside it.
- **Why it matters:** This is a checkable-rule failure, not a stylistic nitpick: AD-6's Rule as written doesn't actually prevent the divergence it claims to (introducing a second, separately-configured runner) — it just relocates the risk to "one config file, wrongly structured," which is arguably worse since it can silently break AD-5's existing suite instead of failing loudly as a missing second tool would.
- **Fix:** State explicitly in AD-6 that `vitest.config.ts`'s `test` key gains a `projects: [...]` array — one project keeping AD-5's existing `environment: 'jsdom'` scope, a second scoped to `CourseContentEditor`'s screenshot tests with `browser: { enabled: true, provider: playwright(), ... }` — so "same file" is accurate without being misleading about what changes inside it.

**4. AD-6 has no treatment of cross-environment screenshot non-determinism, for content types that are unusually sensitive to it.**

- **Where:** AD-6 Binds (line 81): "math/chemistry (KaTeX+mhchem) and Hindi/Devanagari rendering parity." Rule text (line 83) and the frontend spine's Deferred section (lines 205–213) — neither mentions CI/local rendering-environment consistency.
- **What's wrong:** Golden-file pixel-diff testing is well known to produce false-positive failures when the machine generating the baseline and the machine verifying it differ in installed fonts, font hinting/antialiasing, or GPU-vs-software rendering — and Devanagari script plus KaTeX/mhchem math notation are exactly the kind of content most exposed to this (font substitution is far more visible in Devanagari glyph shaping than in Latin text, and math notation is dense with small glyphs where subpixel differences show up as diff noise). AD-6 names none of the standard mitigations (a single canonical Docker image with pinned fonts as the *only* place goldens are generated/updated, `vitest -u` restricted to CI, a documented font-install step) and doesn't list this as a Deferred/open item either.
- **Why it matters:** This is precisely the class of gap the checklist flags — a real divergence point for the level below (one implementer generates goldens on a Mac laptop with different font substitution than the Linux CI runner verifies against, producing perpetually-flaky PRs) that is neither decided nor explicitly deferred, just silent.
- **Fix:** Add a sentence to AD-6 pinning where goldens are authoritatively generated/updated (e.g., "golden screenshots are only ever generated/updated inside the CI container image, via a `vitest -u` job triggered from a PR label — never committed from a local run, to avoid font/rendering drift between environments"), or add it to Deferred with an explicit owner if the decision genuinely isn't ready.

### MEDIUM

**5. AD-4's content-tree/draft-Course ownership gap (corroborating, not new).** `review-adversarial-coursewizard.md` findings 1–2 already document in depth that AD-4's "2+ features → Context" rule doesn't disambiguate `DomainContext.courses` as catalog-summary vs. full authored tree, nor when an in-progress draft Course becomes catalog-visible. Walking the "every dimension the altitude owns is decided, deferred, or an open question" checklist item independently lands on the same real gap — I concur it's unresolved and Critical-adjacent; see that review for the full scenario rather than duplicating it here.

**6. Structural Seed gives CourseWizard/ and CourseContentEditor/ less detail than every sibling entry, inviting the AD-2 hook to be skipped.**

- **Where:** Lines 125–147 (Dashboard/, CourseOverview/, CoursePlayer/) each enumerate a top component *and* a `use<FeatureName>.ts` hook file. Lines 148–149 (`CourseWizard/`, `CourseContentEditor/`) list only the bare folder name plus a prose comment — no hook file named, and unlike `Admin/` (line 150) they carry no "not re-enumerated here" disclaimer to signal the omission is deliberate.
- **What's wrong:** AD-2's rule ("every feature folder gets one [colocated hook], even a thin pass-through — so AD-5's hook-testing convention applies uniformly rather than only to features that 'seem to need it'") still binds `CourseWizard/`/`CourseContentEditor/` regardless of the seed's enumeration, but the inconsistent level of detail — full breakdown for old features, bare name for the two brand-new, most state-heavy features in this update — reads as ambiguous rather than as "left to AD-2's general rule," and is the kind of thing that gets silently skipped under deadline pressure precisely because nothing in the seed shows what it should look like.
- **Fix:** Add at minimum `useCourseWizard.ts` / `useCourseContentEditor.ts` lines to match the sibling entries' detail level, consistent with AD-2's explicit "even a thin pass-through" instruction.

### LOW

**7. Stack table's `@vitest/browser-playwright: latest` version-pin issue (corroborating, not new).** `review-versions-coursewizard.md` already documents the peer-dependency lockstep breakage between `@vitest/browser-playwright@latest` and `vitest: ^4.1` in depth (HIGH in that review); I independently verified the package/API are real via the same web search and concur with that finding — flagging here only to confirm the rubric walk doesn't contradict it, not to re-litigate severity.

**8. AD-6's licensing rationale cites Applitools' "pricing opacity" but is silent on `@vitest/browser-playwright`'s own non-monetary cost: browser-binary footprint.**

- **Where:** AD-6 rule text, line 83: "Chosen over Playwright Test ... and hosted services (recurring cost; Applitools' pricing opacity specifically flagged as the kind of surprise this project avoids per its licensing-sensitive stance elsewhere)."
- **What's wrong:** `@vitest/browser-playwright` still requires downloading actual browser binaries (Chromium/Firefox/WebKit via `npx playwright install`) — real CI-minute and cache-footprint cost, just not a licensing-shaped one. AD-6's own rationale paragraph name-checks the project's stated aversion to unstated recurring costs, but doesn't apply that same lens to the tool it picks.
- **Fix:** Minor — a clause noting the one-time-per-CI-cache browser-binary install cost would make AD-6's own stated cost-consciousness consistent with itself. Low priority; doesn't block anything on its own.

## Summary

- **CRITICAL:** 1
- **HIGH:** 3
- **MEDIUM:** 2
- **LOW:** 2
