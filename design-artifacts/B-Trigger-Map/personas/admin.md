---
title: Persona — Admin (Master / Support)
status: inferred / reconstructed
created: 2026-08-15
---

# Persona: Admin (Master / Support)

> Reconstructed 2026-08-15 from PRD/UX text, not from live user research. Covers `UserRole.Master` and `UserRole.Support`. Named journey character (Rohan) is a PRD-authored illustrative persona, not a real interviewed user. Unlike Student/Tutor, this persona's authority is **not uniform** — several features are Master-only (see "Role split" below), which any future live Trigger Mapping session should preserve as a distinction rather than collapse.

## Who they are

The internal operator role(s) responsible for platform health, vocabulary hygiene, AI cost/vendor control, and (Master only) day-to-day error triage. Master and Support default to the Student Dashboard experience, with a narrow admin-only toggle to preview an empty/demo Tutor Dashboard — they are not real tutors and never see another tutor's live data through that toggle.

### Role split (do not collapse in future work)

| Capability | Master | Support |
|---|---|---|
| Tutor-view Dashboard preview toggle | Yes | Yes |
| Tag Management | Yes | Yes — expanded to Support in this spec since "tag hygiene is routine vocabulary upkeep, not a cost lever" |
| AI Configuration & Usage | Yes | No — "matching its direct control over spend and model routing" |
| Error Log (Centralized Error Observability) | Yes | No — v1 is single-operator-role, Master only |

*(Source: EXPERIENCE.md Information Architecture table, row "Admin"; ErrorObs PRD §2.2 Non-Users)*

## Goals

- Change which AI model powers a given task from a config screen when a provider degrades or a better model appears, with no deploy. *(CourseWizard PRD §2.1 JTBD)*
- Keep the tag/taxonomy vocabulary clean and duplicate-free so search/filtering stays reliable for tutors and students. *(CourseWizard PRD §2.1 JTBD)*
- See every failure across the system in one place, to find and fix real problems before a student or tutor has to report them. *(ErrorObs PRD §2.1 JTBD)*
- Have failures ranked by severity without reading every one first, to focus limited attention on what matters. *(ErrorObs PRD §2.1 JTBD)*
- Clear a fixed issue out of the active queue without permanently losing the record, in case it recurs. *(ErrorObs PRD §2.1 JTBD)*

## Pain points (as implied by what the product changes)

- **Vendor lock-in risk:** without a config-level model swap, an outage or a stale model choice requires a code change/redeploy. *(CourseWizard PRD §2.1 JTBD, §4.1 FR-2)* **[inferred: the fear this JTBD is answering.]**
- **No cost visibility:** nothing tracked AI spend per task before this feature; a runaway or misrouted task could go unnoticed. *(CourseWizard PRD §4.1 FR-4)*
- **Invisible failures:** confirmed directly — "the only trace is a line in a container's stdout log, if that... diagnosing a real production issue this session required manually reading Docker container logs by hand, because no other option existed." *(ErrorObs PRD §1 Vision)*
- **Two specific exception types never logged anywhere** (`DocumentParsingUnavailableException`, `FileScanUnavailableException`) outside a single entity's own status field — a confirmed, named gap, not a general claim. *(ErrorObs PRD §1 Vision)*
- **No frontend crash capture at all:** "a crash simply happens and vanishes." *(ErrorObs PRD §1 Vision)*
- **Untriaged, unranked noise:** without auto-priority, every error would demand equal human attention regardless of actual severity. *(ErrorObs PRD §2.1 JTBD)* **[inferred: the implicit contrast the JTBD sets up.]**

## Psychological drivers

- **Control / Oversight** — a config-only provider/model swap, per-task fallback, and budget-threshold enforcement put spend and vendor risk under direct admin control rather than leaving it to code deploys. *(CourseWizard PRD §4.1, §4.13)*
- **Reduced Anxiety** — near-real-time visibility (errors queryable within under a minute, per SM-2) replaces the anxiety of not knowing what's broken until a user complains. *(ErrorObs PRD §7 Success Metrics SM-2)*
- **Efficiency / Reduced Toil** — auto-categorization and auto-priority remove the need to manually read and triage every single error before knowing what matters. *(ErrorObs PRD §4.4, §4.5)*
- **Trust / Fairness (in the system, not a person)** — deterministic, rule-based (not AI-judged) categorization and priority keep triage explainable and auditable, matching the explicit design rationale against "AI decides" severity assignment. *(ErrorObs PRD §4.5 Description)*
- **Reduced Anxiety (regression-safety)** — Archive/Resolve never permanently destroys a record; Auto-Reopen guarantees a recurrence is never silently missed. *(ErrorObs PRD FR-14, FR-16)*

## Representative scenario

*(Composited from CourseWizard PRD UJ-3 and ErrorObs PRD UJ-1 — not a single sourced narrative.)*

Rohan, the platform admin, notices the current drill-down model is producing shallow explanations after a stronger reasoning model becomes available. He opens AI Configuration & Usage, selects the `explainTopic` task, changes its assigned model, and saves — the next generation for any course uses the new model with no deploy, and the usage/cost view begins reflecting the swap from that point forward. Separately, after a spike in support messages about course uploads failing, a Master admin opens the new Error Log, filters by Category = "External Integration Error" and Priority P0/P1, finds 14 occurrences of the same fingerprint (a 40-minute document-parsing outage, already P1 on sight), opens the detail view, confirms the service is back up, and marks it Resolved — confident that if it recurs, it will reopen automatically rather than silently reappearing as noise.

## Source citations

- CourseWizard PRD: `_specs/planning-artifacts/prds/prd-eLearning-CourseWizard-2026-08-10/prd.md` §2.1, §2.3 UJ-3, §4.1, §4.13
- ErrorObs PRD: `_specs/planning-artifacts/prds/prd-eLearning-ErrorObservability-2026-08-13/prd.md` §1, §2.1, §2.2, §2.3 UJ-1
- EXPERIENCE.md: `_specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md` Information Architecture table ("Admin" row)
