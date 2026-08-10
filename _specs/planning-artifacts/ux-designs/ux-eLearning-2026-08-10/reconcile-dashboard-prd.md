---
title: Input Reconciliation — Dashboard PRD vs DESIGN.md / EXPERIENCE.md
created: 2026-08-10
scope: >
  Reconciles _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md and
  EXPERIENCE.md against their declared source
  _specs/planning-artifacts/prds/prd-eLearning-2026-08-10/prd.md
  ("Dashboard — Role-Aware Merge of Dashboard + Tutor Hub & Booking").
  Note: EXPERIENCE.md also declares a second source (the Assignments PRD), which is
  outside this reconciliation's scope except where it interleaves with Dashboard content
  in ways that matter to the checks below.
---

# Findings

## 1. Information Architecture table vs PRD Dashboard structure

**Mostly accurate, one internal contradiction found (see finding below, shared with §2).**

EXPERIENCE.md's IA table row for Dashboard:
> Student: Weekly Goal → Adaptive Schedule → My Courses → Assignments → Tutor Booking & Group Learning. Tutor: Availability & Performance → Assignments → Course Publishing.

This correctly reflects PRD §4.2's Weekly Goal (FR-6) and Adaptive Schedule (FR-7), §4.2's My Courses (FR-8), §4.3's Tutor Booking & Group Learning (FR-9–14), and §4.4/§4.5's Availability & Performance / Course Publishing for Tutor, in the PRD's own section order (Assignments, from the sister PRD, is correctly interleaved between My Courses and Tutor Booking on the Student side, and between Availability/Performance and Course Publishing on the Tutor side — matching where the Assignments PRD places itself).

**Minor observation (not flagged as an error):** the row omits PRD §4.2's Welcome/streak banner + Resume CTA (FR-4) and Progress stat cards / 7-day activity calendar (FR-5) as named "sections." These are almost certainly not left-nav jump targets (they sit above the section nav, not as a `scrollIntoView` destination), so their absence from an IA *section list* is defensible — but it does mean a reader of the IA table alone would not learn that FR-4/FR-5 content exists at all on the page. Since the task's own framing of "expected" Student sections (Weekly Goal, Adaptive Schedule, My Courses, Tutor Booking & Group Learning) already excludes FR-4/FR-5, this is noted for completeness rather than raised as a defect.

**FR-3 (Master/Support preview toggle) is not represented in the IA table row at all** — it is only covered in the Foundation section's prose ("Master/Support (admin) roles default to the Student experience with a narrow, admin-only toggle to preview an empty/demo Tutor Dashboard"). This is adequate coverage, just not in the table being checked.

## 2. Key Flows UJ-1 / UJ-2 vs PRD's actual UJ-1 / UJ-2 text

**Finding — real contradiction: "default landing surface."**

PRD §2.3 UJ-1 entry state:
> Authenticated, Student role, lands on the single "Dashboard" nav tab (**default landing surface**).

EXPERIENCE.md's own Key Flows UJ-1 step 1 correctly mirrors this: "Lands on the single Dashboard tab."

But EXPERIENCE.md's **Information Architecture table** (the very table checked in §1) asserts the opposite for the *same product*:
> Home (Discover) | **Default landing tab**, logo click | Course catalog browse/search/filter…

This is a direct contradiction within EXPERIENCE.md itself, and it disagrees with the PRD's explicit UJ-1 entry-state text. One of the two claims is wrong: either Dashboard is the default landing surface (per PRD) and the IA table's "Default landing tab" label on Home/Discover is stale, or Discover really is default-landing and the PRD's UJ-1 entry-state parenthetical is wrong (in which case the *PRD* — the thing EXPERIENCE.md is supposed to mirror — needs a correction, not the spine). Given PRD is the authoritative source per this reconciliation task and both PRD occurrences (§2.3, and implicitly the "lands on... Dashboard" framing used consistently across FR-1/FR-2/UJ-2) point to Dashboard-as-landing, this reads like an EXPERIENCE.md authoring slip on the IA table row, not a PRD error. **Recommend fixing the IA table's "Default landing tab" label** (move it off Home/Discover, or clarify "default landing tab *before* auth-role routing exists" vs. post-auth landing) so it doesn't contradict UJ-1's entry state.

**Everything else in UJ-1/UJ-2 mirrors cleanly, with only cosmetic compression:**
- UJ-1 step 4 adds "(or via the left nav's 'Tutor Booking & Group Learning' jump)" — not in the PRD text, but it's a plausible UX elaboration consistent with the left-nav section-jump pattern described elsewhere in EXPERIENCE.md, not a contradiction.
- UJ-2 step 3 drops "from a student" (PRD: "sees a new booking **from a student** with topic on hover"); step 4 drops "for an upcoming masterclass"; step 6 drops the "(via the existing mock service)" parenthetical; the edge case drops "(existing behavior, carried over unchanged)." All are lossy compressions, not misstatements — none change persona, path, climax, or resolution.
- Both climaxes and resolutions are close to verbatim matches.

## 3. State Patterns / Component Patterns vs FR-level behavior

**Gap — FR-3's empty/demo Tutor Dashboard state has no entry in the State Patterns table.** The State Patterns table enumerates several empty states (no submissions, no assignments created, zero submissions on a specific assignment) but has no row for "Master/Support previewing Tutor Dashboard in empty/demo mode" despite this being an explicitly testable FR-3 consequence: *"Toggling to Tutor view renders the full Tutor Dashboard UI (FR-15–FR-19) in an empty/demo state — no real slots, bookings, earnings, or course data."* This is a distinct, non-obvious empty-state variant (the whole Tutor Dashboard is empty by design, not because a real tutor has no data yet) and deserves its own row so it isn't confused with a real tutor's legitimately-empty slot calendar.

**Gap — FR-10's booking race-condition error has no corresponding row.** PRD: *"Booking a slot that's no longer available (race with another student) surfaces an error, not a silent failure."* The State Patterns table's only error row is "Network/session error on refresh"; there is nothing for a failed-booking-attempt error, even though FR-10 explicitly calls this out as testable behavior.

**Gap — FR-11's persistent countdown toast (`AppointmentToast.tsx`) is not distinguished from ordinary confirmation toasts.** PRD FR-11 consequence: the existing 60-minute pre-session countdown toast is carried over unchanged, rendered at the app-shell level. EXPERIENCE.md's Interaction Primitives table only describes toasts generically: *"Toasts for transient confirmations (sign-in/out, booking success) — auto-dismiss, non-blocking, never required reading."* A 60-minute pre-session countdown reminder is a materially different toast pattern (long-lived, informational/time-sensitive) from a transient confirmation toast, and conflating them risks an implementer treating `AppointmentToast` as just another auto-dismissing confirmation.

**Correctly covered:** Booking slot states are well represented — Component Patterns' "Booking slot table/grid" row ("Booked slots are visually distinct (opacity/border) from open ones; 'Book Slot' only renders on open slots") and State Patterns' "Booked slot" row ("'BOOKED' pill, disabled action, opacity-reduced card") together accurately capture FR-10's "moves from available to booked" behavior.

**Minor gap — Public Live Masterclass has no dedicated Component Pattern row.** FR-13 (student browsing/registration) and FR-19 (tutor broadcast roster) are real, distinct FRs with their own UI, mentioned in Key Flows narrative text but never given a behavioral row the way "Booking slot table/grid" or "Assignment creation modal" were. Not necessarily a defect (could be judged out of scope for this pass) but worth a call-out since every other Dashboard-adjacent interactive surface got a row and this one didn't.

## 4. DESIGN.md color/component extraction vs PRD visual-behavior statements

**No contradiction found.** PRD is functional and largely silent on visual treatment, as expected, and the few places it brushes against visual behavior actually align well with DESIGN.md:
- FR-15 (Online/Offline toggle) ↔ DESIGN.md Colors: `signal-green` is explicitly scoped to "online-availability dots," a direct, non-contradictory match.
- FR-16 (bar chart with 3 metrics: earnings/hours/engagement) ↔ DESIGN.md's three reserved chart colors (`chart-teal`/`chart-violet`/`chart-gold`), "reserved for multi-series data visualization only" — consistent (3 metrics, 3 chart colors, no chrome reuse).
- Course/booking status vocabulary ("Draft/Published," "Confirmed") in DESIGN.md's badge-pill component description matches the PRD's own terminology for course wizard and booking states.
- DESIGN.md's "Resolved during this spec's authoring" note about `DashboardSectionNav.tsx` getting a `flex lg:hidden` mobile equivalent is consistent with EXPERIENCE.md's Responsive & Platform section describing the same fix — no PRD conflict, since the PRD doesn't specify nav visual mechanics.

No action needed here.

## 5. PRD content materially relevant to UX but missing from the spines

- **FR-3's "no impersonation" boundary is uncaptured in EXPERIENCE.md.** PRD FR-3 Out of Scope: *"Impersonating a specific real Tutor account's live data — this toggle shows an empty/demo Tutor Dashboard only, not another user's actual data."* Combined with the missing State Patterns row (§3 above), this constraint — which the PRD's own `[NOTE FOR PM]` flags as worth revisiting later — has zero footprint in either spine document. If a future support-troubleshooting flow gets designed against these spines without re-reading the PRD, this boundary could be silently lost.
- **FR-14's "Recent Activity feed stays static/hardcoded" is not mentioned.** This is a real, currently-true UI state (a feed showing non-live data) that a UX spine describing state/empty patterns would normally want to flag, especially since the PRD explicitly notes it as a temporary condition ending in the backend phase — an implementer building against EXPERIENCE.md alone wouldn't know this feed is intentionally static for now.
- **Glossary term "Tutor Slot" is never used by name in EXPERIENCE.md**, though the concept (bookable calendar unit) is present throughout via "slot." Low-severity terminology drift, not a functional gap.
- **Non-Goal "no redesign of individual widgets' visuals/interactions beyond composition"** (§5) has no corresponding guardrail statement in DESIGN.md or EXPERIENCE.md — worth a one-line acknowledgment somewhere since these are exactly the documents someone would consult if tempted to redesign a widget "while they're in there."
- Everything else material — role-purity (SM-C1 / FR-2's role-purity guarantee), the Student/Tutor non-dual-role Non-Goal, and the Synchronous Study Room vs. Group Study Pool distinction — **is** adequately represented in EXPERIENCE.md's Foundation section and IA table.

# Summary of Gaps (ranked)

1. **Contradiction:** IA table labels Home/Discover as "Default landing tab" while both the PRD's UJ-1 entry state and EXPERIENCE.md's own Key Flows UJ-1 step 1 say Dashboard is the default landing surface. Needs a fix to one or the other.
2. **Missing state:** FR-3's Master/Support empty/demo Tutor Dashboard preview has no row in the State Patterns table, and its "no impersonation of a real tutor" boundary is undocumented in EXPERIENCE.md.
3. **Missing state:** FR-10's booking-race-condition error has no corresponding State Patterns row.
4. **Component conflation:** FR-11's persistent 60-minute pre-session countdown toast (`AppointmentToast.tsx`) is not distinguished from ordinary transient confirmation toasts in Interaction Primitives.
5. **Minor coverage gaps:** Public Live Masterclass (FR-13/FR-19) has no dedicated Component Pattern row; FR-14's "Recent Activity is static/hardcoded" state is unmentioned; DESIGN.md/EXPERIENCE.md have no contradictions with PRD visual behavior (§4 clean).
