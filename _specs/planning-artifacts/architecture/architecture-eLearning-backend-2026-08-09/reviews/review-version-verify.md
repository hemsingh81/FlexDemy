---
name: 'Version & Licensing Reality-Check — LearnSphere Backend Architecture Spine'
type: review
reviews: '../ARCHITECTURE-SPINE.md'
reviewed: '2026-08-09'
method: 'web search against live sources (NuGet, GitHub, postgresql.org, dotnet.microsoft.com), as of 2026-08-09'
---

# Review — Version & Licensing Verification

**Scope:** every version/currency claim in the Stack table, plus the licensing claims underpinning AD-3 (no mediator library) and AD-7 (testing conventions). Each claim below was checked against a live web source dated at or near 2026-08-09, not answered from training-data recall.

## Verdict

**Mostly accurate, with two load-bearing licensing errors.** All version/currency claims in the Stack table check out. Both mocking-library license claims that justify AD-7 are wrong on license *type* (though right on the underlying "free to use" conclusion): NSubstitute is BSD-3-Clause, not MIT, and AwesomeAssertions is Apache-2.0, not MIT. These should be corrected since AD-7's rule text and the Consistency Conventions table repeat the "MIT" claim verbatim, and a future reader may rely on the specific license grant (e.g., attribution/trademark clauses differ between MIT, BSD-3, and Apache-2.0).

## Stack Table — Findings

### .NET / ASP.NET Core 10 — "current LTS, supported through Nov 2028" — CONFIRMED
.NET 10 released Nov 11, 2025 as an LTS release, with 3 years of support. Microsoft's own release-notes/support-policy pages and endoflife.date converge on end-of-support in **November 2028** (sources differ on the exact day — Nov 10 vs Nov 14 — but agree on month/year). The claim is accurate; the day-level ambiguity is immaterial.

Sources: https://devblogs.microsoft.com/dotnet/announcing-dotnet-10/ , https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core , https://endoflife.date/dotnet

### Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3 — "requires Microsoft.EntityFrameworkCore ≥10.0.4 <11.0.0" — CONFIRMED
NuGet package metadata for `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 lists a dependency on `Microsoft.EntityFrameworkCore` `>= 10.0.4 && < 11.0.0`, matching the spine exactly.

Source: https://www.nuget.org/packages/npgsql.entityframeworkcore.postgresql/

### PostgreSQL 18 / 18.4 — "current stable, 19 still in beta" — CONFIRMED
PostgreSQL 18.4 (along with 17.10, 16.14, 15.18, 14.23) was released ~Aug 5, 2026 and is the current stable point release on the 18 branch. PostgreSQL 19 is in beta: Beta 1 shipped June 4, 2026, Beta 2 shipped July 16, 2026, with GA expected September/October 2026 — i.e., still beta as of the spine's 2026-08-09 date. Both halves of the claim hold.

Sources: https://www.postgresql.org/about/news/postgresql-184-1710-1614-1518-and-1423-released-3297/ , https://www.postgresql.org/about/news/postgresql-19-beta-2-released-3350/

### xUnit "latest stable" — CONFIRMED, not pinned
The spine doesn't assert a specific version (correctly, since it says "latest stable"). Current latest stable is xunit.v3 3.2.2 (Jan 14, 2026); a 4.0.0 prerelease exists (pre.154, July 2026) but is not GA. No deprecation or supersession concern — xUnit v3 is the actively maintained line.

Source: https://xunit.net/releases/v3/3.2.2 , https://www.nuget.org/packages/xunit.v3

### NSubstitute "latest stable (MIT)" — VERSION CONFIRMED, LICENSE WRONG
Latest stable is NSubstitute 6.0.0 (released ~July 12, 2026) — fine, matches "latest stable," and it is actively maintained. **However, NSubstitute's license is BSD-3-Clause, not MIT.** Fetched the actual `LICENSE.txt` from the NSubstitute GitHub repo directly: it contains the "may not be used to endorse or promote products derived from this software" non-endorsement clause, which is the distinguishing third clause of BSD-3-Clause (absent from BSD-2-Clause and from MIT entirely). MIT and BSD-3-Clause are both short, permissive, commercial-friendly licenses, so the *practical* conclusion the spine draws ("free to use commercially, no reputational baggage") is still correct — but the specific license name asserted in three places (Stack table, AD-7 rule text, Consistency Conventions table) is factually wrong.

Sources: https://github.com/nsubstitute/NSubstitute/blob/main/LICENSE.txt , https://www.nuget.org/packages/nsubstitute/ (NuGet license metadata also tags it BSD-3-Clause)

### Docker / Docker Compose "latest stable" — not independently checked
No specific version is pinned in the spine, so there is nothing falsifiable to verify here beyond "Docker is not deprecated," which is self-evidently true. No finding.

## AD-3 — MediatR Licensing Claim — CONFIRMED

Claim: "MediatR 13+ requires a paid/RPL-1.5 copyleft/commercial license (free tier caps at $5M revenue)."

Verified via Lucky Penny Software's own licensing FAQ and multiple independent write-ups: starting with MediatR v13.0, the project moved to a dual-license model — **Reciprocal Public License 1.5 (RPL-1.5)** (free, but copyleft/reciprocal — you must open-source RPL-covered modifications) or a paid commercial license. The free **Community tier** of the commercial license covers organizations under **$5,000,000 USD gross annual revenue** (with an additional, undisclosed-in-spine condition of not having raised more than $10M in outside capital), non-profits, educational use, and non-production use. The spine's summary ("free tier caps at $5M revenue") is accurate as a simplification; it omits the $10M-raised condition, which is a minor completeness gap, not an error.

Sources: https://luckypennysoftware.com/faq , https://www.jimmybogard.com/automapper-and-mediatr-commercial-editions-launch-today/ , https://github.com/LuckyPennySoftware/MediatR/discussions/1123

## AD-7 — FluentAssertions / AwesomeAssertions Claim — LICENSE TYPE WRONG FOR AWESOMEASSERTIONS

Claim: "FluentAssertions 8+ requires a paid Xceed commercial license for commercial use while v7.x remains Apache 2.0, and AwesomeAssertions is a genuine free MIT fork."

- **FluentAssertions 8+ commercial via Xceed — CONFIRMED.** FluentAssertions partnered with Xceed and moved to a proprietary license starting at v8.0, priced at $129.95/seat for commercial use. Confirmed via InfoQ, DevClass, and Xceed's own FAQ page.
- **FluentAssertions v7.x remains Apache 2.0 — CONFIRMED.** The pre-v8 code line (which AwesomeAssertions forked from) was released under Apache License 2.0, and the spine correctly says v7.x is unaffected.
- **AwesomeAssertions is a genuine, actively maintained free fork — CONFIRMED.** It exists specifically as a community-controlled continuation of FluentAssertions v7.
- **AwesomeAssertions is "MIT" — WRONG.** Fetched the LICENSE file from `github.com/AwesomeAssertions/AwesomeAssertions` directly: it is the **Apache License, Version 2.0** (the license header literally reads "Apache License Version 2.0, January 2004," copyright Dennis Doomen). A maintainer statement quoted in search results is explicit on this point: *"The license will never change, not even to MIT. AwesomeAssertions will only maintain the original Apache 2.0 license."* So AwesomeAssertions did not re-license to MIT when it forked — it kept FluentAssertions v7's original Apache-2.0 license. The spine's "MIT fork" characterization is incorrect; it should read "Apache 2.0 fork" (or just "free/open-source fork," if precision isn't needed).

Sources: https://www.infoq.com/news/2025/01/fluent-assertions-v8-license/ , https://devclass.com/2025/01/16/another-open-source-project-shifts-to-restrictive-license-fluent-assertions-following-xceed-partnership/ , https://xceed.com/fluent-assertions-faq/ , https://github.com/AwesomeAssertions/AwesomeAssertions (LICENSE file fetched directly)

## AD-7 — Moq Claim — CONFIRMED

Claim: "Moq itself remains free/BSD-3-licensed (the 2023 SponsorLink controversy was resolved) but carries reputational baggage, making NSubstitute (MIT) the recommended default instead."

- **Moq is BSD-3-Clause today — CONFIRMED.** Fetched `License.txt` directly from `github.com/devlooped/moq` (formerly `moq/moq4`); it is explicitly headed `"BSD-3-Clause"`, copyright Clarius Consulting / Manas Technology Solutions / InSTEDD / Contributors.
- **SponsorLink controversy (Aug 2023) — CONFIRMED and resolved.** Moq 4.20.0 silently bundled an obfuscated SponsorLink component that hashed the local git `user.email` and phoned it to an Azure endpoint to check GitHub Sponsors status, without clear disclosure. Community backlash followed; the SponsorLink integration was reverted in 4.20.2, and later SponsorLink itself was open-sourced and decoupled from Moq (no longer bundled/obfuscated). So "resolved" is fair, though the reputational damage (many teams migrated away, including to NSubstitute) is real and ongoing, which is exactly the "baggage" the spine cites as the reason NSubstitute is preferred.
- **"NSubstitute (MIT)" repeated here — same error as above.** NSubstitute is BSD-3-Clause, not MIT (see Stack-table finding). This phrase appears verbatim in AD-7's rule text, the Stack table, and the Consistency Conventions table — three repetitions of the same license-name error.

Sources: https://github.com/devlooped/moq/blob/main/License.txt , https://github.com/devlooped/moq/issues/1384 , https://steven-giesel.com/blogPost/1939d20c-2493-4bf7-9636-96436283fb72

## Summary of Findings

| # | Severity | Finding |
| --- | --- | --- |
| 1 | Medium | NSubstitute's license is **BSD-3-Clause, not MIT**, as asserted in three places (Stack table, AD-7 rule, Consistency Conventions table). Practical conclusion (free/permissive/commercial-friendly) is still correct; only the specific license name is wrong. |
| 2 | Medium | AwesomeAssertions' license is **Apache License 2.0, not MIT** — it never re-licensed away from FluentAssertions v7's original Apache-2.0 grant. A maintainer has stated it will never move to MIT. AD-7 calls it a "free MIT fork," which is wrong on the license name (fork status and free-ness are correct). |
| 3 | Low | AD-3's MediatR "$5M revenue" free-tier threshold is accurate but incomplete — Lucky Penny Software's Community tier also requires the org not have raised more than $10M in outside capital. Doesn't change AD-3's conclusion. |
| 4 | Info (confirmed accurate, no action) | .NET 10 LTS-through-Nov-2028, Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3's EF Core dependency range, PostgreSQL 18.4-stable/19-beta status, MediatR RPL-1.5/commercial dual-license model, FluentAssertions 8+ Xceed commercial license and v7.x Apache-2.0 status, and Moq's BSD-3-Clause license with the SponsorLink incident resolved — all check out exactly as stated against live sources dated August 2026. |

## Recommended Fix

In the Stack table, AD-7's rule text, and the Consistency Conventions table, replace:
- `NSubstitute ... (MIT)` → `NSubstitute ... (BSD-3-Clause)`
- `AwesomeAssertions, its free MIT fork` → `AwesomeAssertions, its free Apache-2.0 fork`

These are pure license-label corrections; no rule, invariant, or technology decision needs to change as a result — the "free/permissive/no commercial license required" conclusions in AD-3 and AD-7 both still hold under the corrected license names.
