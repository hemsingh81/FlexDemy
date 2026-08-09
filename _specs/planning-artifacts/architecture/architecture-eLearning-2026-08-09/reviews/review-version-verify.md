# Review: Version & Brownfield-Fact Verification — ARCHITECTURE-SPINE.md

**Target:** `_specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md`
**Method:** Live npm/web verification of every version claim in the Stack table (as of 2026-08-09), plus direct reading of the real files under `FrontEnd/src` and `FrontEnd/package.json` for every brownfield factual claim the spine makes.
**Reviewer:** automated reality-check pass (not a design review — scope is strictly "was this asserted from training data or actually checked").

---

## Verdict

The spine's version claims are **substantially accurate for the two packages it explicitly claims to have "web-verified"** (`vitest ^4.1`, `@testing-library/react ^16.3`), and every brownfield structural/naming claim about the existing codebase checks out against the real files. However, the table's "(unchanged)" existing deps were evidently *not* re-verified against current-as-of-Aug-2026 reality (Vite and TypeScript are now multiple majors behind latest), and two "new" deps pinned only as `latest` (`@testing-library/jest-dom`, `@testing-library/user-event`) carry real risk that wasn't surfaced: jest-dom's latest major bumped its minimum Node.js requirement to 22 with no Node version pinned anywhere in the repo, and user-event's "latest" is a ~2-year-old release the spine implies was freshly checked.

---

## 1. Stack Table — Version Verification

| Row | Spine claim | Verified npm-latest (2026-08-09) | Verdict |
| --- | --- | --- | --- |
| `react` / `react-dom` | `^19.0.1` (unchanged) | 19.2.8 is current npm latest; no React 20 exists | Accurate, not superseded. Range satisfies latest patch. No issue. |
| `typescript` | `~5.8.2` (unchanged) | TypeScript 6.0 shipped 2026-03-23 as a bridge release; 7.0.2 is current npm latest (native Go compiler) | **Materially out of date.** Two majors behind current. Not "deprecated" in the sense of broken, but the spine's "nothing out of date" bar is not met for this row — and it wasn't flagged for review even though it's exactly the kind of claim this check exists to catch. |
| `vite` | `^6.2.3` (unchanged) | Vite 8.2.1 is current npm latest; Vite 7 and 8 have both shipped | **Two majors behind current.** Vite's own support policy backports fixes only to the current major, the previous major (latest minor), and the previous minor — Vite 6 is outside that window once Vite 8 is out, i.e. likely no longer receiving security patches. Still functionally compatible with the proposed `vitest ^4.1` (see §2), so this is not a breakage risk today, but it is a real "superseded" fact the spine's language ("unchanged") glossed over rather than checked. |
| `tailwindcss` | `^4.1.14` (unchanged) | 4.3.3 is current npm latest; no Tailwind 5 exists yet | Accurate, not superseded — only a minor/patch delta, still the current major line. No issue. |
| `vitest` | `^4.1` (new) | 4.1.10 is current npm latest, released within the last ~30 days | **Confirmed accurate** — this is the one row the spine explicitly claims was web-verified, and it holds up. |
| `@testing-library/react` | `^16.3` (new) | 16.3.2 is current npm latest; confirmed React 19 support (RTL v13+ requires React 18, v16 extends to React 19) | **Confirmed accurate** — also explicitly claimed as web-verified, and it holds up. |
| `@testing-library/jest-dom` | `latest` (new) | Resolves to **7.0.0**, published ~15 days before the spine's date | See §3 below — this is a live risk the spine's "latest — DOM matchers" one-liner doesn't surface. |
| `@testing-library/user-event` | `latest` (new) | Resolves to **14.6.1**, last published ~2 years ago (no v15 exists) | See §3 below — technically the correct current version, but not "web-verified current" in the sense the spine's parenthetical implies for the other two rows; it's stale by omission. |
| `jsdom` | `latest` (new) | Resolves to 30.0.1, current npm latest | Accurate, current, no issue. |

## 2. Compatibility Checks

- **Vitest 4 ↔ Vite 6:** Vitest 4.0 requires Vite `>= 6.0.0`; `@vitest/mocker` / `vite-node` declare `"^5.0.0 || ^6.0.0"` as their peer range internally, and the current 4.1.x line continues to support Vite 6. **The spine's compatibility claim ("Vite-native, zero extra config against Vite 6") is correct.**
- **Vitest 4 ↔ Node:** Vitest 4 requires Node `>= 20.19` (20.x line) or `>= 22.12` (22.x line). Nothing in `FrontEnd/package.json` pins an `engines` field, and no `.nvmrc` / `.node-version` file exists anywhere under `FrontEnd/`. This isn't a spine error per se, but it's an unverified assumption the spine relies on silently.
- **React 19 ↔ Testing Library 16.3:** Confirmed compatible; real-world 2025/2026 upgrades report `@testing-library/react@16.3.x` working against `react@19.x`. Spine's claim holds.
- **`@testing-library/jest-dom` 7.0.0 ↔ Node:** jest-dom's v7 changelog states the **minimum supported Node.js version is now 22**, and `@testing-library/dom` became a *required* peer dependency (previously bundled/optional in earlier majors). Combined with the missing Node-version pin noted above, pulling in `latest` for this package is not risk-free the way the spine's one-line entry implies — if the actual dev/CI Node version is < 22, `npm install` will surface a peer-dependency/engine warning or hard failure depending on `.npmrc` strictness. **This should have been checked and wasn't.**
- **`@testing-library/user-event` ↔ `@testing-library/dom` peer version:** user-event 14.6.1 declares a peer range for `@testing-library/dom`; since RTL v16 also made `@testing-library/dom` a peer (rather than a bundled transitive dep), there's a known historical footgun in this ecosystem around mismatched `@testing-library/dom` versions across `user-event` and `@testing-library/react` causing hard-to-diagnose `act()` warnings. Worth a version-pin sanity check at actual `npm install` time; not confirmed broken, but not confirmed *safe* by the spine either.

## 3. Findings on the "new" deps pinned as `latest`

Two of the five "new" Stack rows are pinned to the floating `latest` tag rather than a version range, and the spine's parentheticals ("DOM matchers for assertions", "interaction simulation for RTL tests") give no indication either was actually resolved and checked against what `latest` currently means:

- `@testing-library/jest-dom` → `latest` silently resolves to **v7.0.0**, a major released only ~2 weeks before the spine's date, carrying a Node ≥22 floor and a newly-required peer dependency. This is exactly the kind of "asserted, not reality-checked" gap the review was asked to catch.
- `@testing-library/user-event` → `latest` resolves to **14.6.1**, a ~2-year-old release. Not wrong (it is genuinely the current version — the package has had no major bump since), but the spine treats it with the same "latest" shorthand as the actively-releasing packages around it, which invites false confidence that it was freshly checked the same way `vitest` and `@testing-library/react` explicitly were.

**Recommendation:** pin explicit version ranges (e.g. `^7.0`, `^14.6`) instead of `latest` for both, and add a Node engine floor (`>=22`) to `package.json` before adding jest-dom v7, or deliberately pin jest-dom to a v6.x range if the team's actual Node runtime is below 22.

## 4. Brownfield Factual Claims — Verified Against Real Files

All checked directly against the repository, not asserted:

| Claim in spine | File(s) checked | Result |
| --- | --- | --- |
| `@/*` → project-root alias exists in tsconfig | `FrontEnd/tsconfig.json` | **True.** `"paths": { "@/*": ["./*"] }` (lines 18-22). |
| `@/*` alias also defined in Vite config | `FrontEnd/vite.config.ts` | **True.** `resolve.alias['@'] = path.resolve(__dirname, '.')` (lines 9-13), matching the tsconfig root-relative mapping. |
| `src/components/CoursePlayer/` is "a top file + colocated subcomponents" | `FrontEnd/src/components/CoursePlayer/*` | **True.** Contains `CoursePlayer.tsx` (top file) plus `DrilldownPanel.tsx`, `FlashcardsModal.tsx`, `FocusSessionTimer.tsx`, `PlaybackControls.tsx`, `ReaderCanvas.tsx`, `ScratchpadPanel.tsx` colocated in the same folder — exactly the pattern described. (Note: `useCoursePlayer.ts` does **not** yet exist — it's correctly proposed as new in the Structural Seed, not claimed as already present.) |
| PascalCase.tsx component naming | `FrontEnd/src/components/*.tsx` | **True.** `Dashboard.tsx`, `Navbar.tsx`, `AccessibilityModal.tsx`, `TutorEducatorHubView.tsx`, etc. — all PascalCase. |
| camelCase.ts utils/lib naming | `FrontEnd/src/lib/*.ts` | **True.** `i18n.ts`, `tts.ts`, `offlineStorage.ts`. |
| SCREAMING_SNAKE_CASE mock/constant exports (`MOCK_COURSES`, `INITIAL_USER`) | `FrontEnd/src/data/mockData.ts` | **True.** Line 3: `export const INITIAL_USER: UserProfile = {...}`; line 40: `export const MOCK_COURSES: Course[] = [...]`. |
| No test framework installed | `FrontEnd/package.json` | **True.** No `vitest`, `jest`, `@testing-library/*`, or `jsdom` in `dependencies`/`devDependencies`. |
| No state-management library installed | `FrontEnd/package.json` | **True.** No `redux`, `zustand`, or `jotai` present. |

No factual discrepancies found in this section — everything the spine asserts about the current brownfield codebase is directly verifiable and correct.

---

## Summary of Findings by Severity

1. **[Medium]** `@testing-library/jest-dom: latest` resolves to v7.0.0, which requires Node.js ≥22 and makes `@testing-library/dom` a required peer — and no Node version is pinned anywhere in `FrontEnd/` (`package.json` has no `engines`, no `.nvmrc`). This is a real install/CI risk the spine doesn't surface.
2. **[Low-Medium]** `vite ^6.2.3` and `typescript ~5.8.2`, both marked "(unchanged)", are now respectively 2 and 2 majors behind current npm latest (Vite 8.2.1; TypeScript 7.0.2, with 6.0 as a March-2026 bridge release). Not broken today, but the spine's "unchanged" framing appears to have skipped the same reality-check applied to `vitest`/`@testing-library/react` — Vite 6 is likely outside Vite's own security-patch support window now that 7 and 8 exist.
3. **[Low]** `@testing-library/user-event: latest` resolves to 14.6.1, last published ~2 years ago — technically correct (no newer major exists) but presented with the same "web-verified" confidence as actively-releasing packages without saying so.
4. **[Info/Confirmed-good]** The two claims the spine explicitly says were web-verified — `vitest ^4.1` (latest is 4.1.10, requires Vite ≥6.0.0, compatible) and `@testing-library/react ^16.3` (latest is 16.3.2, confirmed React 19 support) — check out exactly as stated.
5. **[Info/Confirmed-good]** Every brownfield factual claim (`@/*` alias in both tsconfig.json and vite.config.ts, `CoursePlayer/` top-file-plus-colocated-subcomponents structure, PascalCase/camelCase/SCREAMING_SNAKE_CASE naming conventions, absence of any test framework or state-management library in `package.json`) was verified directly against the real files and is accurate.
