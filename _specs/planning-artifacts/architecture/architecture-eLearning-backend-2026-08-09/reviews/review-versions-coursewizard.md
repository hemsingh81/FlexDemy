# Review: Version/Reality-Check Verification — AD-14 through AD-19 (Hangfire / Polly additions)

**Lens:** every committed decision must be web-researched or reality-checked, not asserted from training data — current versions, that named tech still exists/fits, live starter defaults (n/a, brownfield addition to an already-scaffolded spine).

**Scope:** AD-14–AD-19 and the two new Stack table rows (Hangfire, Hangfire.PostgreSql), re-verified independently via web search/fetch on 2026-08-11 rather than trusting the spine's own "web-verified Aug 2026" tags.

## Verdict

The two headline claims the spine flags as "web-verified Aug 2026" — Hangfire 1.8.24 and Hangfire.PostgreSql 1.21.1 — check out as accurate and current, but AD-14's companion claim that Polly is MIT-licensed is factually wrong (it's BSD-3-Clause) and carries no version at all, which matters precisely because this spine treats license identification as a load-bearing decision input (AD-3, AD-7, AD-10).

## Findings

### 1. [HIGH] Polly's license is misstated as MIT — it is BSD-3-Clause

- **File:** `ARCHITECTURE-SPINE.md`, AD-14, line 126
- **Claim in spine:** *"implemented with **Polly** (MIT, the standard .NET resilience library — no license-risk overlap with AD-3's concerns)"*
- **Verified (2026-08-11):**
  - NuGet gallery (`nuget.org/packages/polly/`) lists the license as **BSD-3-Clause**.
  - The upstream repo's `LICENSE` file (`github.com/App-vNext/Polly`, raw at `raw.githubusercontent.com/App-vNext/Polly/main/LICENSE`) confirms: *"BSD 3-Clause License, Copyright (c) 2015-2025, App vNext."*
  - Every sibling package (`Polly.Core`, `Polly.Extensions`, `Polly.RateLimiting`) carries the same BSD-3-Clause tag.
- **Why it matters:** this spine is unusually careful about license provenance as a *decision driver* — AD-3 rejects MediatR over its RPL-1.5 terms, AD-7 picks NSubstitute explicitly for its license over Moq, AD-10 rejects AutoMapper over the same 2026 licensing shift as MediatR. Citing the wrong license for Polly (a permissive BSD grant, not MIT) is a small textual error with an outsized blast radius: it's asserted with unwarranted confidence ("no license-risk overlap") in the exact section of the document that exists to make license claims trustworthy, and it wasn't actually checked against the web despite reading as if it had been.
- **Fix:** change AD-14 line 126 to read `Polly (BSD-3-Clause, App vNext — same license family as NSubstitute's BSD-3-Clause pick in AD-7, no license-risk overlap with AD-3's concerns)`.

### 2. [MEDIUM] Polly has no version pin, unlike every other Stack entry

- **File:** `ARCHITECTURE-SPINE.md`, AD-14 (line 126) and the Stack table (lines 173–184)
- **Issue:** every other library named in the Stack table — Npgsql, EFCore.NamingConventions, xUnit, NSubstitute, Hangfire, Hangfire.PostgreSql — gets a specific version with a "web-verified Aug 2026" tag. Polly is introduced in AD-14 by name and license claim only, with no version, and it isn't added to the Stack table at all.
- **Verified (2026-08-11):** current stable is **Polly 8.7.0** (`nuget.org/packages/polly/`, last published 2026-06-10; ~6.5M downloads). Note Polly 8.x is a major-version rewrite from the legacy Polly 7.x API (different builder/pipeline API surface) — worth pinning explicitly so an implementer doesn't reach for 7.x patterns from older tutorials/training data.
- **Fix:** add a Stack table row — `Polly | 8.7.0 (BSD-3-Clause, App vNext — web-verified Aug 2026)` — and cite the same version in AD-14's prose, the way AD-15 cites Hangfire's version inline.

### 3. [LOW] AD-15's "LGPLv3" framing for Hangfire is accurate but incomplete — it omits Hangfire's dual/commercial licensing model

- **File:** `ARCHITECTURE-SPINE.md`, AD-15, line 132
- **Claim in spine:** *"Hangfire Core + Hangfire.PostgreSql (LGPLv3; different author/company than MediatR/AutoMapper...)"*
- **Verified (2026-08-11):** `hangfire.io/licenses.html` confirms Hangfire Core is **multi-licensed**: LGPLv3 is the free/default tier, but Hangfire OÜ also sells commercial EULAs (Standard and Royalty-free) for teams that want to privately fork/modify the source without LGPL's reciprocal terms. The spine's "LGPLv3" tag is correct for the tier this project would actually consume (unmodified, dynamically-referenced NuGet package — no LGPL reciprocal obligation triggered), and the "no license-risk overlap with MediatR/AutoMapper" conclusion holds up. But stating it as a flat "LGPLv3" fact, full stop, undersells that this was a judgment call among a menu of licenses rather than the package's only option — a reader skimming just this line could assume Hangfire is single-licensed the way NSubstitute or Polly are.
- **Fix (optional polish, not blocking):** reword to `Hangfire Core + Hangfire.PostgreSql (LGPLv3 — the free tier of Hangfire's multi-license model; used here unmodified via NuGet, so LGPL's reciprocal terms aren't triggered; different author/company than MediatR/AutoMapper, so no license-risk overlap with AD-3's concerns)`.

### 4. [INFO — no action required] Hangfire 1.8.24 and Hangfire.PostgreSql 1.21.1 both check out

- Confirmed via `nuget.org/packages/hangfire.core/` and `nuget.org/packages/Hangfire.PostgreSql/`: **Hangfire.Core 1.8.24** is the current latest (published 2026-07-16), and **Hangfire.PostgreSql 1.21.1** is the current latest release from the `hangfire-postgres` GitHub org (a community-maintained fork/continuation, distinct from `HangfireIO` — the spine doesn't claim otherwise, so this is just a confirmation, not a finding).
- AD-13's cross-reference to AD-15 (Hangfire server runs in-process in the `api` container, no Redis, no new Compose service) is internally consistent with AD-15's own text — no drift between the two mentions.

### 5. [INFO — watch item, not a finding] AD-14's "OpenAI-compatible client" names no concrete package to version-check

- **File:** `ARCHITECTURE-SPINE.md`, AD-14, line 126
- AD-14 says the Infrastructure-layer AI gateway implementation is "the HTTP-calling implementation (OpenAI-compatible client per PRD FR-2)" without naming a specific NuGet package (e.g., the official `OpenAI` SDK, `Azure.AI.OpenAI`, or a bare `HttpClient`). This isn't a false or stale claim — there's simply nothing named yet to verify. Flagging only so that whichever concrete package gets chosen at implementation time is given the same version-pin + web-verification treatment the rest of this table gets, rather than being added later without a citation.

## Summary Table

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | HIGH | Polly license misstated as MIT; actually BSD-3-Clause | Correct AD-14's license text |
| 2 | MEDIUM | Polly has no version pin / no Stack table row | Add `Polly 8.7.0` to Stack table + AD-14 |
| 3 | LOW | AD-15's "LGPLv3" for Hangfire omits its dual-license model | Reword for precision (optional) |
| 4 | INFO | Hangfire 1.8.24 / Hangfire.PostgreSql 1.21.1 confirmed current | None — verified accurate |
| 5 | INFO | No concrete "OpenAI-compatible client" package named yet | Version-pin whichever package is chosen, later |
