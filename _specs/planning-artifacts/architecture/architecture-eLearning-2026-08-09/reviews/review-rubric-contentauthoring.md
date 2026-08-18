---
title: Rubric Review — ContentAuthoring PRD absorption into Frontend + Backend Architecture Spines
status: final
created: 2026-08-17
reviewed:
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
against:
  - _specs/planning-artifacts/prds/prd-eLearning-ContentAuthoring-2026-08-16/prd.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
scope: 'Frontend AD-9, AD-10, amended AD-4; Backend amended AD-17/AD-20, AD-28, AD-29'
---

# Rubric Review — ContentAuthoring PRD Absorption

## Verdict: THIN

Individually, every new/amended AD (frontend AD-9, AD-10, AD-4; backend AD-17, AD-20, AD-28, AD-29)
is well-reasoned, cites real prior-art, and is enforceable *for the slice of the problem it
addresses*. The failure mode here isn't sloppy writing — it's that the two hardest, highest-blast-
radius integration surfaces this PRD actually creates are left completely unaddressed: (1) how a
real student reads a Published course's authored content at all, and (2) how one continuous
Tiptap document per Chapter maps back onto the backend's per-entity write endpoints. Both are
exactly the kind of "real divergence point for the level below" this checklist exists to catch,
and both would cause expensive, silent rework if discovered at story time instead of now. That's
what keeps this at THIN rather than ADEQUATE despite the genuine quality of what *is* here.

## Finding Counts

| Severity | Count |
| --- | --- |
| Critical | 3 |
| High | 4 |
| Medium | 4 |
| Low | 2 |

---

## Critical Findings

### C1 — Backend AD-29 resolves only a sliver of OQ-11; students still cannot read a Published course's actual content through any defined route

**Where:** Backend `ARCHITECTURE-SPINE.md`, AD-29, and its Api Structural Seed comment on `ContentController.cs`.

OQ-11 asks: *"What is the authorization model for student and reviewer read-access to **outline/page/resource content** once a course leaves Draft?"* — explicitly three things: outline, page, resource.

AD-29's Rule only touches one: `GET /resources/{id}/content` gains a policy branch for
`Published ∧ (enrolled ∨ owner ∨ Admin)`. Its own **Binds** line scopes it to *"`GET
/resources/{id}/content` and any other **resource-read** route"* — i.e. the `Resource` domain
entity specifically, not `Page.BodyMarkdown` or the `Chapter/Topic/Subtopic` outline. The Api
Structural Seed makes this explicit: *"every action behind `EnsureOwnedDraftAsync` (authoring) OR
AD-29's Published+enrolled/owner/admin policy (**resource reads only**)"*.

That leaves `GET /outline` and `GET /pages/{id}` — the routes that actually carry the Markdown text
a student is supposed to read (DD-2: *"Every word a student reads lives on a Page"*) — still gated
by `EnsureOwnedDraftAsync`, i.e. still owner-and-Draft-only per Appendix B's original scoping. A
non-owner (any real student) has no defined path to read a Published course's page bodies or
outline at all. AD-29 is captioned *"Resolves OQ-11"* — that overclaims; it resolves the resource-
bytes third of a three-part question and leaves the other two-thirds (the actually load-bearing
two-thirds — page text is the product) silent.

**Impact if uncaught:** this is not a rough edge, it's the read path for the feature's entire
reason to exist. Discovering this gap at story time (C-9/C-10 in the PRD's own slicing) means
either a rushed, unreviewed policy addition to `ContentController` under deadline pressure, or a
second architecture pass mid-sprint.

### C2 — No spine defines how one continuous Tiptap document per Chapter maps onto the backend's per-entity write endpoints during autosave

**Where:** Frontend AD-9, AD-10, AD-4 (Tiptap/CourseContentContext split); backend Appendix-B-derived
routes (`PATCH /nodes/{id}`, `PATCH /pages/{id}`).

DD-4 (PRD) and AD-9 (frontend) both commit to a **single continuous ProseMirror document per
Chapter** — Chapter title, Topic/Sub-Topic headings, and every Page nested under them, all in one
editor instance, in reading order. The backend's write surface, however, is per-entity: `PATCH
/nodes/{id} {name?, description?}` for a Chapter/Topic/Subtopic, `PATCH /pages/{id} {title?,
bodyMarkdown?}` for a Page — i.e. one write target per structural heading *and* one per Page,
scattered throughout that same single document.

FR-34's autosave ("saves on a debounce after typing stops and on blur/close... per-block") therefore
requires the editor to, on every save tick: (a) determine which entity (which Chapter/Topic/
Subtopic/Page id) owns the edited span, by walking the document to find the nearest preceding
structural heading/Page-marker and the next heading of equal-or-higher level; (b) extract exactly
that entity's own text/Markdown slice, not the whole document; (c) route it to the correct one of
four different endpoints. This "one-document-to-many-entities" boundary-detection-and-dispatch
layer is arguably the single hardest piece of engineering AD-9 introduces, and it is not named,
placed in the Structural Seed, or assigned an owner by AD-9, AD-10, or AD-4. Nor is it mentioned
that inserting a new structural heading via the slash-menu (AD-10) must itself fire an immediate
`POST /topics` (etc.) to obtain a real id *before* any content nested under it can be attached to
something — a materially different lifecycle than a Tiptap node existing purely client-side.

**Impact if uncaught:** without an assigned owner for this logic, two engineers independently
building C-6/C-7 (per the PRD's own story slicing) will very likely invent incompatible document-
to-entity mapping strategies — exactly the divergence AD-9's own "Prevents" clause claims to guard
against, just one level deeper than what it actually addresses.

### C3 — Frontend has no consumer for the new content graph in the actual (non-preview) Course Player

**Where:** Frontend `ARCHITECTURE-SPINE.md` Structural Seed, `features/CoursePlayer/`.

`CoursePlayer/` is listed in the Structural Seed unchanged — `CoursePlayer.tsx`,
`useCoursePlayer.ts`, `DrilldownPanel.tsx`, `FlashcardsModal.tsx`, `FocusSessionTimer.tsx`,
`PlaybackControls.tsx`, `ReaderCanvas.tsx`, `ScratchpadPanel.tsx` — with no new service wiring for
fetching Page/Resource content or resolving `resource:{resourceId}` URIs. `CourseContentContext`
(AD-4) is explicitly scoped to *"shared by `CourseContentEditor` and `CoursePlayer`'s
Review-as-Student mode"* — the tutor-facing preview path (AD-3's sanctioned cross-feature import),
not real student consumption of a genuinely Published course.

FR-30 is explicit that `resource:` URIs must be *"resolved to a real signed/served URL at render
time, both in the editor preview and **the student player**"* — a requirement with a named target
(the student player) that has no corresponding service, hook, or folder entry anywhere in the
frontend spine. This is the frontend-side twin of C1: even if C1 were fixed and a real read route
existed, nothing in the frontend architecture says who calls it or where the result renders.

**Impact if uncaught:** a whole product dimension (how a real student reads what the tutor
authored) is silently absent from the spine rather than decided, deferred with rationale, or
raised as an open question — precisely what the checklist's last bullet warns against.

---

## High Findings

### H1 — No Structural Seed home for the custom Tiptap Node extensions the PRD's block set requires

**Where:** Frontend AD-9/AD-10, Structural Seed `lib/editor/`.

`lib/editor/` is scoped explicitly to *"the generic Tiptap Suggestion-based menu mechanism (query
filter, keyboard nav, positioning, ARIA wiring)"* — the slash-menu only. `@tiptap/starter-kit`
covers paragraphs/lists/basic marks, but FR-13's Page marker (a real `h4` carrying a title +
Confirmed/Unconfirmed badge-pill), FR-36/FR-43's Learning Resources block (a card-framed,
reusable, multi-context component per DESIGN.md's `content-resource-block`), and FR-28's
Callout/Math/Resource-card blocks are all **custom Tiptap Node/NodeView extensions** that don't
ship in `starter-kit` and aren't placed anywhere in either AD or the Structural Seed. It's
genuinely ambiguous whether these belong in `lib/editor/` (reusable, per AD-10's own stated
rationale — "the tutor explicitly wants this editing pattern reusable... generally") or
`features/CourseContentEditor/` (domain-specific rendering). AD-9's stated "Prevents" — *"two
engineers independently reinventing... heading semantics, undo/redo, drag-reorder, or the
slash-menu's ARIA combobox wiring"* — is only half-delivered: the menu mechanism is placed, the
block-node implementations it inserts are not.

### H2 — AD-9/AD-10's "ARIA wiring" is a label, not a bound contract

**Where:** Frontend AD-9, AD-10.

EXPERIENCE.md and DESIGN.md specify the slash-menu's accessibility contract in real detail:
`role="combobox"` on the trigger with `aria-expanded`/`aria-controls`, `role="listbox"`/`role="option"`
on the menu, category labels as skipped `role="group"`, `aria-activedescendant` for the highlighted
option, a literal "No matching blocks" zero-match row, Tab never repurposed as in-menu navigation,
Escape returning focus to the exact typed position, and a keydown handler gated on
`!event.isComposing` scoped to the editor's own region (IME/Firefox-Quick-Find safety). AD-9 cites
this only as "its query-filter/highlight/keyboard-nav mechanics are what the accessibility review
flagged as underspecified when hand-rolled," and AD-10 says the mechanism "has... ARIA wiring" — 
neither AD actually binds implementation to this specific contract, and Tiptap's own
Suggestion utility ships none of it (it's a trigger-detection plugin, not a UI/ARIA layer). Since
AD-9's stated Prevents is specifically "reinventing... the ARIA combobox wiring," and the Rule
doesn't reference the one document that actually specifies that wiring, the AD doesn't fully
deliver on its own claim.

### H3 — JWT-policy-gated resource content has no defined path for `<img>`/download consumption

**Where:** Backend AD-29.

AD-29 explicitly rejects signed URLs — *"resource reads extend the **existing** JWT +
`FeatureAuthorizationHandler` policy pattern... rather than introducing signed URLs as a second,
novel mechanism."* That's a reasonable, enforceable decision on its own terms, but neither spine
addresses the practical consequence: a plain `<img src="...">` (for an Inline-role image resource)
or a direct download `<a href>` cannot attach an `Authorization: Bearer <jwt>` header. Something
has to bridge JWT-gated bytes to a browser-native `src`/`href` — a fetch-and-blob-URL indirection,
a short-lived query-string token, or cookie-based auth alongside the JWT — and none of the three is
named. This may already be solved by the existing `CourseFilesController`'s `.../download` route
(pre-existing, per the PRD's §1.1 "what exists today" table), in which case AD-29 should say so
explicitly and reuse the pattern; as written, it's silent, and FR-30's own text calls out this
exact rendering path ("in... the student player") as something that must work.

### H4 — Migration/backfill sequencing (OQ-16) is silently absent from both Deferred sections

**Where:** Both spines' Deferred sections.

The PRD is unusually forceful here: §6.3's `[NOTE FOR PM]` states migration "is not merely
'blocking for §6.3'" and that shipping the DD-5 behavior change (uploaded files stop being
content) before the backfill story (C-11) lands is *"a real production incident, not a rough
edge"* — and OQ-16 marks this **"Blocking for release sequencing."** Neither Frontend nor Backend
Deferred section names this at all — not as a decision, not as an explicit deferral-with-rationale,
just absent. Granted this leans more product/release-planning than architecture-substrate, but
given the PRD explicitly asks architecture-adjacent readers to weigh in (flag-gating vs. atomic
release is a real technical choice — e.g., whether `RUN_MIGRATIONS_ON_STARTUP`-style env gating or
a feature flag is the mechanism), a pointer in Deferred costs one line and its absence leaves this
looking unconsidered rather than intentionally out of scope.

---

## Medium Findings

### M1 — Node `Description` text's home (Context vs. Tiptap document) and its resync path are undefined

Frontend AD-4's reshaped `CourseContentContext` holds *"outline metadata (Chapter/Topic/Subtopic/
Page **titles** + confirmation state, not page bodies)"* — Description is never mentioned. But
DD-2/FR-4/FR-5 make node Description real, student-facing content ("what a student will get from
this chapter"), authored inline in the same flowing Tiptap document as everything else (FR-10:
"writes the chapter overview as an ordinary paragraph block" immediately under the `h1`). If
Description lives only inside the per-chapter Tiptap fetch (not in Context), that's plausible but
unstated; if it's expected in Context too, AD-4 never says how an inline edit to a Description
paragraph (which the Tiptap editor owns) propagates back to Context's separately-fetched copy
(used elsewhere, e.g., the Table-of-Contents rail, lifecycle confirmation badges). This is a real
staleness risk left to story-time guessing.

### M2 — The exact `GET .../chapters/{id}/document` route and its response shape aren't jointly defined

Frontend AD-4/AD-9 depend on *"the backend's `GET .../chapters/{id}/document` endpoint"* fetched
"in one call." Backend's Application seed comment gestures at a *"`GET .../document` full-chapter-
fetch endpoint"* on `IContentService`, and the Api Structural Seed's `ContentController.cs` line
mentions "GET .../document" in prose — but this route is **not** in the PRD's Appendix B route
table (which only has per-page `GET /pages/{id}`), and neither spine states its response shape
(does it include Descriptions? confirmation state? all nested Topics/Subtopics/Pages with bodies
in one payload, or just Pages?). The two spines agree the endpoint exists in spirit; neither pins
down its contract, which is exactly the kind of "do both agree on what's meant by the same cited
route" check this review was asked to make.

### M3 — `IContentService`'s backing `IContentRepository` is never named, and AD-20 doesn't flag its own exception to AD-4's per-entity repository convention

Backend AD-20's Application seed comment references *"one repository for the whole outline"* inline
inside the `IContentService` bullet, but no `IContentRepository` interface is ever listed under
`Application/Courses/` or implemented under `Infrastructure/Repositories/` (which lists
`CourseRepository`, `TutorSlotRepository`, etc., but no `ContentRepository`). AD-4 (Repository +
UoW) implies one `I{Entity}Repository` per entity; AD-20's single-repository-for-five-entities
shape is a legitimate PRD-inherited exception (Appendix A's own rationale — cross-entity
operations like reorder/cascade-delete/move don't fit a per-entity repo), but AD-20 never says so
explicitly, unlike AD-25 which *does* explicitly call itself "a bounded exception to AD-20." Minor
inconsistency in how exceptions to prior ADs get flagged.

### M4 — AD-29's role check doesn't name a "reviewer" role, which OQ-11 explicitly asked about

AD-29's policy branch is `Published ∧ (enrolled ∨ owner ∨ Admin)`. OQ-11 asks about "student and
**reviewer**" read access. If reviewers in this codebase are simply Master/Support acting as
Admin, this is already covered — but AD-29 never states that equivalence, leaving a small,
easily-resolved ambiguity about whether a distinct reviewer concept exists outside Admin.

---

## Low Findings

### L1 — No Consistency-Conventions row for Tiptap extension/node file naming

Both AD-9's new files (custom Node extensions, once H1 above is resolved) and `lib/editor/`'s
contents have no naming convention entry in the Consistency Conventions table, unlike every other
new file category this spine introduces (services, hooks, tests). Minor completeness gap, not
load-bearing on its own — folds into H1's fix.

### L2 — `GET /outline`'s "page stubs (no bodies)" phrasing vs. AD-4's "titles + confirmation" phrasing aren't reconciled word-for-word

Appendix B says `GET /outline` returns *"full outline + page stubs (no bodies)"*; AD-4 says
Context holds *"titles + confirmation state, not page bodies."* These likely describe the same
payload, but "full outline" (Appendix B) plausibly includes Description while "titles" (AD-4) reads
narrower — same root ambiguity as M1, listed separately here only because it's a wording mismatch
between the two documents' own text rather than a missing decision.

---

## What's Solid (not findings, noted for balance)

- **AD-17's snapshot-scope carve-out** (deep-copies `Page.BodyMarkdown` + `Resource` metadata, not
  file bytes; hard-delete blocked while referenced by *any* version) is a clean, enforceable,
  correctly-scoped extension of FR-25/FR-31 that actually resolves OQ-8's versioning half.
- **AD-20's polymorphic `OwnerType`/`OwnerId` for Page/Resource** matches the PRD's own Appendix A
  sketch exactly, states its DB-cascade trade-off explicitly, and doesn't disturb the existing
  typed-FK outline shape — a well-targeted, minimal-diff decision.
- **AD-28's explicit `foreignObject` denial**, named against a specific historical CVE rather than
  assumed from library defaults, is exactly the kind of enforceable, non-hand-wavy security rule
  this checklist wants to see.
- **AD-29's rejection of signed URLs in favor of the existing JWT+policy pattern** is a real,
  specific decision that prevents two engineers from picking structurally different auth
  mechanisms — it's just incomplete in scope (see C1) and unresolved in practice (see H3).
- **The backend's Deferred section correctly reconciles FR-24** (future AI-extraction
  reinstatement) with AD-14's already-planned `AiGateway` rebuild, explicitly noting the
  proposal-not-authoritative constraint — a brownfield-context call that would have been easy to
  miss and wasn't.
