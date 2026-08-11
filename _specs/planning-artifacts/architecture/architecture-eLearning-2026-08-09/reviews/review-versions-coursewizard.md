# Reviewer Gate — Lens: Web-Verified Versions & Reality-Checked Decisions

**Scope:** AD-6 (`ARCHITECTURE-SPINE.md` lines 79–83) and its Stack table entry for `@vitest/browser-playwright` (line 113), plus a spot-check of the other Stack table version pins (lines 104–112).

**Method:** independent web search/fetch as of Aug 2026 (not trusting the spine's own "web-verified" citations), against npm registry, official Vitest docs, and the vitest-dev/vitest GitHub repo.

## Verdict

AD-6's core technical claims hold up — `@vitest/browser-playwright` is a real, current npm package, `toMatchScreenshot()` is the correct Vitest 4 browser-mode API, and Playwright is genuinely used only as a *provider* (not a second test runner) — but the citation is not fully accurate: it pins the provider package to the floating `latest` tag despite that package having a strict lockstep peer-dependency on the exact `vitest` core version (a real, documented breakage mode), and it understates the CI-pipeline changes actually required.

## Findings by Severity

### HIGH

**1. `@vitest/browser-playwright: latest` + `vitest: ^4.1` is a real, documented install-breaking combination.**
- **File/line:** Stack table, line 108 (`vitest`) vs. line 113 (`@vitest/browser-playwright`)
- **What's wrong:** `@vitest/browser-playwright` declares a peer dependency that must match the installed `vitest` core version essentially exactly. This is not hypothetical — [vitest-dev/vitest issue #8797](https://github.com/vitest-dev/vitest/issues/8797) documents npm refusing to install when the two packages drift even a *patch* version apart (`Found: @vitest/browser-playwright@4.0.2 ... Conflicting peer dependency: vitest@4.0.3`). The spine pins `vitest` to a range (`^4.1`) but pins the provider to the unpinned `latest` tag. The moment `npm install` resolves `@vitest/browser-playwright` to a newer patch than the `vitest` range allows (or vice versa on a future `npm update`), the install breaks.
- **Fix:** Pin `@vitest/browser-playwright` with the same version discipline as `vitest` (e.g., also `^4.1`, ideally sourced from the same variable or kept in a renovate/dependabot version group so they always bump together), not `latest`. Note this coupling explicitly in AD-6 or the Deferred section so future maintainers don't decouple them.

### MEDIUM

**2. "same CI job as AD-5's existing suite" overstates how unchanged the pipeline is.**
- **File/line:** AD-6 rule text, line 83
- **What's wrong:** AD-5's existing suite is `vitest` + `jsdom` — no browser binaries involved. Enabling the Playwright browser-mode provider requires an additional step to actually install browser binaries and OS-level system dependencies (verified via Vitest's own browser-mode CI guidance and community setup examples: `npx playwright install --with-deps chromium` before `vitest run --browser.headless`). That's a genuinely new CI step with its own runtime cost, cache/artifact footprint, and Linux-runner system-dependency surface — not "no change," even though it's true there's no *second test runner* or separate `playwright.config.ts`.
- **Fix:** Amend AD-6 to state plainly that the CI job gains a `playwright install --with-deps` step (and account for the added minutes / caching strategy), rather than implying the pipeline is untouched. The "no second runner, no second config file" claim can stay — it's accurate — but "same CI job" should be corrected to "same CI job, plus a one-time browser-binary install step."

### LOW

**3. `latest` as a version "citation" is self-defeating.**
- **File/line:** Stack table, lines 112–113 (`jsdom`, `@vitest/browser-playwright`)
- **What's wrong:** Two Stack rows are pinned to the floating `latest` tag rather than a resolved version number, unlike every other row in the table (which cites an actual version, e.g. `16.3.2`, `4.1.10`). "Web-verified Aug 2026" attached to a `latest` pin only verifies that the package existed at that moment — it says nothing about what will actually get installed later, defeating the purpose of the other rows' concrete version pins.
- **Fix:** Resolve `jsdom` and `@vitest/browser-playwright` to the actual current version number at citation time (same treatment already given to `vitest`, `@testing-library/react`, etc.), and switch to a caret/tilde range once resolved.

## What Checked Out (no defect)

- **`@vitest/browser-playwright` exists and is current:** confirmed on the npm registry (19 dependents at time of check) and in the `vitest-dev/vitest` monorepo at `packages/browser-playwright`. Not a fabricated or deprecated package name.
- **`toMatchScreenshot()` is the correct, real API name:** confirmed against the official Vitest docs (`vitest.dev/guide/browser/visual-regression-testing`), which show the exact pattern AD-6 implies: `await expect(page.getByTestId('hero')).toMatchScreenshot('hero-section')`. Vitest 4.0 shipped this as part of browser mode graduating to stable.
- **"No second runner" is accurate:** Playwright is used strictly as a browser-automation *provider* for Vitest's own browser mode, not as the Playwright Test runner. No `playwright.config.ts` is required — provider config lives in the existing `vitest.config.ts` via `test.browser.provider`. This part of AD-6's framing is correct, unlike the "same CI job" framing above.
- **Spot-checked Stack rows (not the AD-6 focus, but requested):**
  - `vitest ^4.1` — current npm latest independently confirmed as `4.1.10`. Matches the citation.
  - `typescript ~5.8.2` / `vite ^6.2.3` — both already flagged by the spine itself (Deferred section) as "2 majors behind current npm latest." Independently verified: TypeScript's npm latest is now `7.0.2` (5.8 → 5.9 → 6.0 → 7.0, the Go-rewrite release) and Vite's npm latest is `8.2.1` (6 → 7 → 8). The spine's own self-assessment is accurate, not overstated or understated.
  - `@testing-library/react ^16.3` — current npm latest independently confirmed as `16.3.2` with confirmed React 19 type-inference support. Matches the citation.

## Summary

- **HIGH:** 1
- **MEDIUM:** 1
- **LOW:** 1
