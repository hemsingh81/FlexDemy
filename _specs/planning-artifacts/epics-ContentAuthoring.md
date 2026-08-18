---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _specs/planning-artifacts/prds/prd-eLearning-ContentAuthoring-2026-08-16/prd.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md
  - _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md
---

# eLearning (Tutor Content Authoring — Document Canvas, Pages & Per-Page Resources) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the ContentAuthoring PRD,
decomposing its 48 FRs, the two architecture spines' new/amended decisions, and the UX spine's
document/slash-command interaction contract into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A course has an ordered list of Chapters. A Chapter has an ordered list of Topics. A Topic has an ordered list of Sub-Topics. Depth is fixed at three; there is no fourth level.
FR2: A Page attaches to exactly one node, which may be a Chapter, a Topic, or a Sub-Topic. Pages are ordered within their node.
FR3: Sub-Topics are optional. A Topic with pages and no sub-topics is a complete, valid, publishable structure.
FR4: Every node has: Name (required, ≤200 chars), Description (optional, ≤2000 chars, Markdown-lite: paragraphs and bullets only), optional cover image, ordered resources, confirmation state.
FR5: A node's Description renders to students as a section-opening card before that node's first page.
FR6: Deleting a node cascades to its descendants, their pages, and every resource owned by the node or any descendant node/page. Delete is confirm-gated and states the exact count being destroyed, broken out by kind.
FR7: Nodes and pages reorder within their sibling group via drag-and-drop and via keyboard-accessible move-up/move-down controls.
FR8: A page can be moved to a different node in the same course. Its own resources and body move with it; inherited node resources are re-resolved against the new ancestry (in-body resource references are NOT auto-fixed — see OQ-13).
FR9: When a course has an empty outline, the Course Content Editor opens on one empty document, cursor active on the Chapter-title heading.
FR10: The Chapter title is the document's h1. The tutor writes the chapter overview as an ordinary paragraph immediately below it, plus an optional repeatable "What you'll learn" bullet list. A cover image and chapter-level Learning Resources block may be inserted here or later.
FR11: Topics are inserted via "/" (Topic heading) as an h2 with a description paragraph beneath it, anywhere in the document. No minimum count is enforced by the editor.
FR12: Sub-Topics are inserted via "/" (Sub-Topic heading) nested under a Topic heading, as an h3 with its own description paragraph. Entirely optional.
FR13: Pages are inserted via "/" (New Page) under a Topic or Sub-Topic heading, as an h4 structural marker carrying a title and per-page Confirmed/Unconfirmed state.
FR14: The "/" menu is fully keyboard-operable (Arrow Up/Down, Enter, Escape); the "+" click affordance is visible on hover AND keyboard focus. There is no step indicator.
FR15: Every insertion and edit persists on its own block-blur (autosave, FR34) — not on completing a step.
FR16: Reopening a course with an incomplete outline shows the exact same document, content intact — no "Continue setting up" affordance.
FR17: "Add chapter" inserts a new empty document the same way FR9 describes the first one. Every other creation (topic, sub-topic, page, block, resource) goes through the same "/" or "+" mechanism.
FR18: The existing upload → scan → parse pipeline is unchanged (Uploaded Files strip with Queued/Parsing/Done/Failed, retry, delete, drag-and-drop).
FR19: The page editor offers "Insert from file," listing every Done source file for the course.
FR20: The picker shows the file's parsed Markdown in a two-pane selector (source with selectable top-level sections; insert preview). Selection granularity for v1 is whole file or one-or-more top-level sections.
FR21: Insert places the selected Markdown at the current cursor block in the page body, as ordinary editable blocks, unmarked and unlocked.
FR22: The picker offers "Also attach this file to this page as a resource," defaulted on.
FR23: Deleting a source file after extraction is allowed and warns only that it disappears from the picker/attached pages — never that page text will change.
FR24: Where the AI structure-extraction pipeline is reinstated, it produces a proposal the tutor accepts/edits/discards — never an authoritative write. Out of MVP scope; the contract is fixed now.
FR25: A page has a Title (required, ≤200 chars) and a body.
FR26: The "/" slash-command menu offers, at minimum: Paragraph, Sub-heading, Bulleted list, Numbered list, Code, Image, Callout, Table, Math, Divider, Resource card — plus, at the appropriate nesting point, Topic heading / Sub-Topic heading / New Page / Learning Resources block, all in the same menu. A page-body "Sub-heading" block is h5/h6, never h2/h3 (those are reserved for structural Topic/Sub-Topic headings).
FR27: A Code block carries an optional language, emitted as the fenced-code info string.
FR28: Three block types need renderer work: Math ($$…$$ via KaTeX), Callout (blockquote with `> [!note]` marker, styled card), Resource card (link with a `resource:` URI, download card).
FR29: Blocks are reorderable by drag and by keyboard, convertible between compatible types (paragraph ↔ bullets ↔ numbered ↔ sub-heading ↔ callout), duplicable and deletable. Structural headings are NOT part of this conversion set.
FR30: Resource references are stable IDs, never storage URLs — `![alt](resource:{resourceId})` / `[label](resource:{resourceId})`, resolved to a real signed/served URL at render time in both the editor preview and the student player.
FR31: Deleting a resource referenced by its page body is blocked, naming the referencing block(s), offering "Remove from content and delete" as an explicit second action.
FR32: "Preview" toggles the page between edit and rendered-as-student view. A "Markdown" view shows/permits direct editing of the raw body.
FR33: Editing raw Markdown that produces constructs the block editor cannot represent is preserved verbatim as an uneditable-in-blocks "raw" block, never silently dropped.
FR34: Autosave — the page body saves on a debounce after typing stops and on blur/close, with an explicit saved/saving/failed indicator. A failed save is loud, retryable, and never navigates away from unsaved content.
FR35: Alt text is a first-class, prompted field on every image block.
FR36: A page's resources live in a Learning Resources block, inserted via "/" like any other block, listing that page's own resources plus read-only inherited ancestor resources. Generic/reusable — the identical component FR43 uses at node level.
FR37: A resource is added to a Learning Resources block by drag-and-drop, file picker, or promoting an existing course source file ("Attach existing file") — all three are real, keyboard-operable controls.
FR38: Every resource has a role: Inline, Attachment, or both — defaulting to Inline for images, Attachment otherwise — changeable afterwards.
FR39: Every resource has an editable display label and an optional short caption/description.
FR40: Resources are ordered within their owner; Attachment-role resources render to students in that order.
FR41: Uploaded resources go through the same malware-scan and secure-storage path as source files. A failed scan is rejected with its reason and never attaches.
FR42: Accepted resource types for v1: images (png/jpg/jpeg/gif/webp/svg), documents (pdf/doc/docx/txt/xls/xlsx), code/text files (a bounded extension allowlist — see Appendix A). Per-file/per-course size caps as already enforced.
FR43: Node-level resources use the same Learning Resources block (FR36), inserted via "/" directly on the Chapter/Topic/Sub-Topic heading's own document position.
FR44: Confirmation semantics — a text-only edit preserves confirmation; a structural edit (add/delete/reorder/move a child, add/remove/re-role a resource) resets the immediate parent to Unconfirmed. A page's own confirmation resets on any structural change to its body's non-text blocks. A page move resets both source and destination immediate parents AND the moved page's own confirmation.
FR45: "Move to Review" is blocked while any node or page is Unconfirmed, with the lifecycle bar listing blockers as direct links into the outline. Replaces the existing file-parsed check in MoveToReviewAsync outright (not kept as a redundant guard).
FR46: "Preview as student" is available at page, node, and course scope, rendering through the same component path the student player uses.
FR47: Accessibility — every drag interaction has a keyboard-operable equivalent; block/outline reordering announces via aria-live; the outline is a proper tree with roving tabindex; alt text is prompted; focus is never lost across autosave or block conversion.
FR48: Safety and scale — the no-raw-HTML guarantee is preserved end-to-end, extended to uploaded SVG (server-side sanitized). Ownership + Draft-state guards apply to every mutation. Bounded limits per course are enforced server-side with clear errors.

### NonFunctional Requirements

NFR1 (from FR47, Accessibility): WCAG-aligned keyboard operability for every drag interaction, aria-live announcements for reordering and confirmation reversion, proper ARIA tree semantics with roving tabindex, prompted alt text, focus never lost across autosave/block conversion. Extended by the UX spine's full ARIA combobox/listbox contract for the "/" slash-menu (role=combobox/listbox/option, aria-activedescendant, Tab never repurposed, IME/Firefox-Quick-Find-safe keydown gating).
NFR2 (from FR48, Safety): No-raw-HTML guarantee end-to-end, including sanitized SVG uploads (HtmlSanitizer, explicit foreignObject/script/event-handler denial — backend AD-28). Ownership + Draft-state guards on every mutation.
NFR3 (from M-6, Reliability): Zero content-loss reports attributable to autosave; <0.5% of saves failing unrecovered. No page-level "leave without saving?" dialog exists as a fallback — autosave is the sole safety net (frontend AD-11), so a defined, visible-text, retryable failure state is load-bearing, not optional polish.
NFR4 (from Appendix A, Scale bounds): 100 chapters/course, 100 topics/chapter, 50 sub-topics/topic, 200 pages/node, 50 resources/owner, 25 MB/resource, 256 KB/page body — enforced server-side with clear errors.
NFR5 (from backend AD-29, Security/Authorization): Non-owner reads of a course's outline/pages/resources require the existing JWT + FeatureAuthorizationHandler policy pattern, not a new mechanism (no signed URLs). Two distinct conditions: reviewer/admin access works during InReview/ReviewConfirmed/Published; student access requires Published + enrolled, defaulting to deny until a real enrollment primitive exists.

### Additional Requirements

**Backend architecture (architecture-eLearning-backend-2026-08-09):**
- Chapter/Topic/Subtopic remain explicit typed entities with real FKs; Page and Resource use polymorphic OwnerType+OwnerId instead of nullable multi-FKs (AD-20). No DB-level FK/cascade for Page/Resource ownership — cascade-delete is a service-layer responsibility, exercised by tests.
- OwnerType is a C# enum (`ContentOwnerType { Chapter, Topic, Subtopic, Page }`), stored via EF Core `.HasConversion<string>()` (not numeric, to avoid ordinal-drift). Exact member spelling (`Subtopic`, one word) is the wire contract both backend and frontend `types.ts` must match verbatim, checked by a shared contract test.
- IContentRepository: one repository for the whole outline (Chapter/Topic/Subtopic/Page/Resource together), an explicit named exception to the per-entity-repository default.
- CourseVersion snapshots are versioned relational rows (VersionedChapter/Topic/Subtopic/Page/Resource), never a single JSON blob — required so the resource-delete-guard's "referenced by any version snapshot" query is indexed and cheap. Deep-copy covers Page.BodyMarkdown + Resource metadata, not resource file bytes. Hard-deleting a Resource is blocked while referenced by any version snapshot; soft-delete via the existing AuditableEntity.IsDeleted convention.
- New endpoint: `GET /api/v1/courses/{courseId}/chapters/{chapterId}/document` — full nested Chapter→Topics→Sub-Topics→Pages(with bodies)→Resources in one payload, including Description. Distinct from `GET /outline`, which omits Page.BodyMarkdown ("page stubs").
- FR45's Move-to-Review gate reconciliation: `CourseService.MoveToReviewAsync`'s existing file-parsed check is removed outright and replaced by the confirmation-based check — no transition period.
- Uploaded SVG resources are sanitized server-side via HtmlSanitizer (mganss, 9.1.973 MIT), explicit SVG-safe tag allowlist, explicit denial of `<script>`, `on*` event-handler attributes, and `foreignObject`. Lives in `Infrastructure/Sanitization/`, called ahead of parsing.
- Non-owner resource/outline/document reads extend the existing JWT + FeatureAuthorizationHandler policy pattern across all three read routes (`GET /outline`, `GET .../document`, `GET /resources/{id}/content`) — not resources alone. Reviewer = Admin (Master/Support) acting in a review capacity; no distinct Reviewer role exists. Binary content served to `<img>`/`<a>` consumers reuses whatever mechanism the existing `CourseFilesController.../download` route already uses for authenticated binary delivery (confirm exact mechanism against live code, not a new one).
- Enrollment primitive does not exist anywhere in the domain model — out of this PRD's scope to design; AD-29's student-read branch defaults to deny until it exists (a named product gap, not a security hole to paper over).
- Migration/backfill release sequencing (OQ-16) needs a real technical choice (feature-flag gating DD-5's behavior vs. shipping the backfill story atomically with it) before C-11 is scheduled — currently undecided in both spines' Deferred sections.

**Frontend architecture (architecture-eLearning-2026-08-09):**
- Editor foundation: Tiptap (`@tiptap/react`/`core`/`starter-kit` 3.x, MIT) + `@tiptap/markdown` (official, MIT, bidirectional CommonMark) — not hand-rolled contenteditable, not the paid Tiptap Pro Conversion extension.
- Real native `contenteditable` heading elements back every structural level: Chapter=h1, Topic=h2, Sub-Topic=h3, Page marker=h4 — never a styled `div`/`textarea` standing in for a heading.
- The "/" slash-menu mechanism (generic, no domain knowledge) lives in `lib/editor/`, called directly by `features/CourseContentEditor/` (an explicit, named exception to the "lib/ only via services/" rule). The ContentAuthoring-specific command list is feature-owned config passed into the generic menu.
- Custom Tiptap Node extensions (PageMarker, LearningResourcesBlock, Callout, Math, ResourceCard) live in `features/CourseContentEditor/extensions/` — domain-specific, not in `lib/editor/`.
- Description-zone content restriction (FR4's "paragraphs and bullets only") is a client-side Tiptap schema constraint, not server-side-only validation — the slash-menu is cursor-position-aware and filters out Image/Table/Math while the cursor is inside a Description zone.
- New autosave-mapping layer (`useContentAutosave.ts` or equivalent) owns document-to-entity boundary detection: on each save tick, walk the ProseMirror doc to find the enclosing structural heading/Page marker, extract only that entity's slice, dispatch to the correct endpoint. A newly-inserted structural heading/Page synchronously awaits its create call before nested content is attachable.
- Confirmation-state resync: the autosave PATCH response includes the affected entity's post-write confirmation state; the frontend patches CourseContentContext directly with it — never a full outline refetch — so the ToC rail's badge and aria-live reversion announcement fire off the actual write.
- `lib/markdown.ts` remains the single canonical Markdown grammar authority. Tiptap's custom Math/Callout/ResourceCard node serializers are tested for syntax-level round-trip parity against it (not just AD-6's visual/pixel parity) — including adjacency cases (e.g. inline math beside a Callout in one paragraph).
- CourseContentContext (reshaped) holds outline metadata only — titles, Descriptions, confirmation state — never page bodies. The Tiptap editor instance owns body content, fetched via `GET .../chapters/{id}/document`.
- Reading (both Review-as-Student and the real student CoursePlayer) never goes through a Tiptap instance — only authoring does. Both render via the existing `lib/markdown.ts`. CoursePlayer fetches per-page (`GET /pages/{id}`, matching the existing drilldown navigation pattern); Review-as-Student fetches per-chapter via the same `GET .../document` endpoint the editor uses, repeated per Chapter for a whole-course walk. `resource:{id}` URIs resolve via a shared `courseContentService.resolveResourceUrl()`, used identically by both.
- Migration/backfill: whether the new document-canvas UI needs a feature flag until backend's C-11 backfill ships is an open technical choice, mirrored in Deferred alongside the backend item.

### UX Design Requirements

UX-DR1: Real native `contenteditable` heading elements (h1 Chapter / h2 Topic / h3 Sub-Topic / h4 Page marker) — never a styled `div` wrapping a separate input field.
UX-DR2: "/" slash-command menu full ARIA contract — `role="combobox"`/`aria-expanded`/`aria-controls` on the trigger; `role="listbox"`/`role="option"` on the menu; category labels as `role="group"`, skipped by Arrow-key traversal; `aria-activedescendant` for the highlighted option; a literal "No matching blocks" row for the zero-match state (never a blank/collapsed menu).
UX-DR3: "+" click affordance is the accessible primary entry point — visible on hover AND keyboard `:focus`/`:focus-within`, never hover-only, at the start of every empty line and end of every block.
UX-DR4: IME composition and Firefox Quick-Find safety — the "/" keydown handler is scoped to the editor's own editable region (never a document-level listener) and gated on `!event.isComposing`.
UX-DR5: Slash-menu keyboard model — Arrow Up/Down moves the highlighted option; Enter commits; Escape closes without inserting, strips the typed "/"+query, and returns focus to the exact document position where "/" was typed. Tab is never repurposed as an in-menu navigation key.
UX-DR6: Post-insert behavior — focus moves into the newly inserted block's first editable field; an `aria-live="polite"` region announces what was inserted (e.g. "Image block inserted," "New Page added").
UX-DR7: Table-of-Contents rail is auto-derived from the document's own headings (not a separately-managed tree) and includes Page markers as real navigable stops, matching native screen-reader heading-navigation. Activating a rail entry moves real DOM focus (`tabindex="-1"` + `.focus()`), not a scroll-only jump.
UX-DR8: Confirmed/Unconfirmed state is a shape-differentiated glyph (filled check vs. outline circle) beside headings, and a textual badge-pill on Page markers — never color-alone.
UX-DR9: Generic "Learning Resources" block, the identical component whether attached to a Chapter, Topic, Sub-Topic, or Page body — never a fixed sidebar-only panel. Resource rows carry real keyboard-operable controls: a role selector (not a static badge), an inline-editable caption, and remove/reorder (non-drag move-up/move-down) controls. Inherited/read-only rows show a real focusable link to the owning ancestor, never plain descriptive text.
UX-DR10: Resource drop-zone offers real Upload / Attach-existing / Insert-from-file buttons as the non-drag equivalent — drag-and-drop is never the only path.
UX-DR11: Reduced-motion — the slash-menu's open/dismiss transition and any block-insert animation respect `prefers-reduced-motion: reduce`, matching every other animated surface already covered in the spec.
UX-DR12: New State Patterns rows required: Empty/first-open (one empty document, no "Continue setting up"); cold-load when reopening an existing document; autosave-failure (visible-text error, retry action, `aria-live` announcement — there is no page-level unsaved-changes dialog as a fallback); viewing a Published (read-only) course (banner + link to Take Offline); slash-menu zero-match.
UX-DR13: Switching Chapters (client-side content swap, no router) moves focus to the newly-loaded Chapter's h1 title, so a screen-reader user is never left positioned inside now-replaced DOM content.
UX-DR14: Design tokens for four new components — `content-doc-heading` (plain typography, shape-differentiated confirmation glyph), `content-page-marker` (dashed top rule, document glyph, badge-pill), `content-resource-block` (parchment fill, rounded.lg), `content-slash-menu` (white overlay, shadow-xl, filter-echo row, grouped command rows) — all specified in DESIGN.md, none of them reusing the superseded `content-tree-node` visual language.

### FR Coverage Map

FR1: Epic 7 - Chapter has ordered Topics, Topic has ordered Sub-Topics, depth fixed at three
FR2: Epic 7 - Page attaches to exactly one node, ordered within it
FR3: Epic 7 - Sub-Topics optional; Topic-with-pages-no-subtopics is valid
FR4: Epic 7 - Node fields: Name, Description, cover image, resources, confirmation state
FR5: Epic 7 - Node Description renders as a section-opening card
FR6: Epic 7 - Cascade delete with confirm-gated destruction count
FR7: Epic 7 - Drag and keyboard reorder for nodes/pages
FR8: Epic 7 - Move a page to a different node
FR9: Epic 7 - Empty course opens on one empty document
FR10: Epic 7 - Chapter title (h1), overview paragraph, "what you'll learn" bullets
FR11: Epic 7 - Topics inserted via "/" as h2 headings
FR12: Epic 7 - Sub-Topics inserted via "/" as h3 headings, optional
FR13: Epic 7 - Pages inserted via "/" as h4 structural markers
FR14: Epic 7 - "/" menu keyboard-operable; "+" affordance focus-visible
FR15: Epic 7 - Per-block-blur autosave, not step-completion
FR16: Epic 7 - Reopening an incomplete outline shows the same document, no "Continue setting up"
FR17: Epic 7 - "Add chapter" and every other creation via "/" or "+"
FR18: Epic 10 - Existing upload/scan/parse pipeline unchanged
FR19: Epic 10 - "Insert from file" lists parsed source files
FR20: Epic 10 - Two-pane selector, whole-file or by-section
FR21: Epic 10 - Insert places Markdown at cursor as editable blocks
FR22: Epic 10 - "Also attach this file as a resource" option, defaulted on
FR23: Epic 10 - Deleting a source file after extraction warns, never changes page text
FR24: Epic 10 - AI structure-extraction is a proposal, never authoritative (contract only, out of MVP build)
FR25: Epic 7 - Page has Title and body
FR26: Epic 7 (basic blocks) / Epic 9 (Image/Callout/Table/Math/Resource card) - "/" menu's content block set
FR27: Epic 7 - Code block optional language
FR28: Epic 9 - Renderer work for Math/Callout/Resource card
FR29: Epic 7 (basic types) / Epic 9 (remaining types) - Block reorder/convert/duplicate/delete
FR30: Epic 8 (editor-preview half) + Epic 11 Story 11.4 (student-player half) - Resource references are stable IDs, resolved at render time
FR31: Epic 8 - Delete-blocked-while-referenced guard
FR32: Epic 7 - Preview / Markdown duality
FR33: Epic 7 - Unsupported raw Markdown preserved verbatim
FR34: Epic 7 - Autosave with saved/saving/failed indicator
FR35: Epic 9 - Alt text prompted on every image block
FR36: Epic 8 - Learning Resources block (page-level + inherited)
FR37: Epic 8 - Add resource via drag-drop, file picker, or attach-existing
FR38: Epic 8 - Resource role: Inline, Attachment, or both
FR39: Epic 8 - Editable label and caption
FR40: Epic 8 - Resource ordering within owner
FR41: Epic 8 - Malware scan reuse
FR42: Epic 8 - Accepted resource types allowlist
FR43: Epic 8 - Node-level resources via the same block
FR44: Epic 7 (core mechanics) / Epic 11 (lifecycle-gate integration) - Confirmation semantics
FR45: Epic 11 - Move to Review blocked while Unconfirmed; replaces old file-parsed gate
FR46: Epic 11 - Preview as student at page/node/course scope
FR47: Epic 7 - Cross-cutting accessibility
FR48: Epic 7 + Epic 8 (cross-cutting) - Safety, scale bounds, SVG sanitization

## Epic List

### Epic 7: Course Outline & Basic Page Authoring via the Document Canvas
A tutor can open an empty course and, through one continuous "/"-driven document, build out Chapter→Topic→Sub-Topic structure, add Pages anywhere in it, move pages between nodes, and write basic content (paragraphs, sub-headings, bullet/numbered lists, code) — with real-time per-block autosave, keyboard/screen-reader accessibility, and confirmation tracking. **Scoping note (party-mode pressure-test, 2026-08-17):** this delivers JTBD-1/2/6 fully and JTBD-3 partially — a text/list/code-first authoring baseline, not the full "mix the right kinds of content" page (images/math/callouts complete in Epic 9). Don't oversell this epic's page as "published-ready" on its own. **Story-sizing note:** this epic's size (26 FRs, including the Tiptap/slash-menu foundation AD-9/AD-10/AD-11 calls the hardest integration surface in the architecture) is a reason to slice it into several small stories at story-creation time (e.g. canvas shell + Tiptap wiring; structural-heading insertion; page + basic blocks; autosave/confirmation) — not a reason to split the epic itself, since none of those pieces has standalone user value on its own.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR25, FR26 (basic blocks), FR27, FR29 (basic blocks), FR32, FR33, FR34, FR44 (core), FR47, FR48 (outline/page half)

### Epic 8: Per-Page & Per-Node Resources
A tutor can attach pictures, PDFs, and code files to any page or node via a reusable Learning Resources block — with Inline/Attachment roles, captions, ancestor inheritance, and protection against deleting a resource still referenced in page content. **Implementation notes (party-mode pressure-test, 2026-08-17):** (1) SVG sanitization (backend AD-28, HtmlSanitizer) ships as a Day-1 acceptance criterion on this epic's first resource-upload story — never a "sanitize later" fast-follow. (2) FR-31's delete-in-use guard is a deliberate no-op for the duration this epic ships alone: no `resource:{id}` reference can exist in a page body until Epic 9's Image/Resource-card blocks land, so every resource will appear unreferenced until then. Expected, not a bug — don't "fix" it with a fake check. (3) This epic and Epic 9 have no hard technical dependency per the architecture's own story slicing (resource domain and renderer extensions are parallel-buildable) — the value-delivery order below is intentional (JTBD-5 before richer content types), but a team may build them concurrently.
**FRs covered:** FR30, FR31, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR48 (resource half)

### Epic 9: Rich Content Blocks — Images, Math, Callouts, Tables
A tutor can enrich a page beyond prose: inline images with required alt text, mathematical/chemical notation, callout boxes, tables, and resource-reference download cards — completing JTBD-3's "page that mixes the right kinds of content," and activating FR-31's delete-in-use guard for the first time (see Epic 8's implementation notes). Technically parallel-buildable with Epic 8 (see Epic 8's notes), sequenced after it here for value-delivery order.
**FRs covered:** FR26 (remaining block types), FR28, FR29 (remaining), FR35

### Epic 10: Extraction from Uploaded Files
A tutor can pull text from an already-uploaded, parsed document straight into a page — whole-file or by-section — instead of retyping, with the option to also attach the source as a downloadable resource.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24

### Epic 11: Confirmation Gate, Lifecycle Integration & Preview as Student
A tutor sees exactly which nodes/pages block moving a course to Review, and can preview any page/node/whole-course exactly as a student will before publishing. Also wires the real Course Player's read path (FR-30's "student player" half — caught as a gap in the story-level party-mode review) so a future Enrollment epic has something to flip open, not something to build from scratch.
**FRs covered:** FR45, FR46, FR44 (lifecycle integration), FR30 (student-player half, party-mode addition)

### ~~Migration — Existing Draft-Course Backfill~~ — NOT NEEDED (2026-08-17)
**Dropped, not deferred — no epic number assigned.** (Not "Epic 6": this project uses one continuous epic-number sequence across all PRDs, and Epic 6 already belongs to AdminSettings' second epic per `epics-AdminSettings.md` / `sprint-status.yaml` — this dropped item must never claim a number from that sequence.) The application is still in development — no production/staging Draft courses with parsed-but-unpaged content exist to protect. This resolves the PRD's OQ-1 as §6.3's Option 3 ("No backfill... correct only if no real Draft courses with parsed content exist yet") and makes OQ-16's migration-sequencing concern moot — there is nothing to sequence. If any existing dev/test course data breaks under DD-5's behavior change, it may simply be deleted/reset rather than migrated. No stories are created for this item.
**FRs covered:** none (§6.3's migration requirement is out of scope, not built)

---

## Epic 7: Course Outline & Basic Page Authoring via the Document Canvas

A tutor can open an empty course and, through one continuous "/"-driven document, build out Chapter→Topic→Sub-Topic structure, add Pages anywhere in it, move pages between nodes, and write basic content — with real-time per-block autosave, keyboard/screen-reader accessibility, and confirmation tracking. Delivers JTBD-1/2/6 fully, JTBD-3 partially (text/list/code baseline; images/math/callouts complete in Epic 9).

### Story 7.1: Document Canvas Foundation & the "/" Slash-Command Menu

As a tutor,
I want to open the Course Content Editor on an empty course and get a working "/"-driven document canvas,
So that I have a single, keyboard-accessible way to start authoring instead of a wizard or an empty tree.

**Acceptance Criteria:**

**Given** a course with an empty outline
**When** the tutor opens the Course Content Editor
**Then** it opens on one empty document, cursor active on the Chapter-title heading, with no wizard step or step indicator (FR-9, FR-14)

**Given** the tutor's cursor is on an empty line
**When** they type "/"
**Then** a filterable, categorized command menu opens at the cursor, keyboard-operable via Arrow Up/Down/Enter/Escape, with a "No matching blocks" row when nothing matches the typed query (FR-14, UX-DR2, UX-DR5)

**Given** the "/" menu is open
**When** the tutor presses Escape
**Then** the menu closes without inserting, the typed "/"+query is stripped, and focus returns to the exact document position "/" was typed at (UX-DR5)

**And** a "+" click affordance is available at the start of every empty line and end of every block, visible on hover AND keyboard focus (never hover-only), opening the identical menu without typing "/" (FR-14, UX-DR3)
**And** the "/" keydown handler is scoped to the editor's own region and gated on `!event.isComposing`, so it never fires mid-IME-composition or collides with the browser's native Quick Find (UX-DR4)
**And** on committing a menu selection, focus moves into the new block's first editable field and an `aria-live="polite"` region announces what was inserted (FR-14, UX-DR6)
**And** the slash-menu's open/dismiss transition and any block-insert animation respect `prefers-reduced-motion: reduce` (UX-DR11)

**Given** a course with existing content
**When** the tutor reopens the Course Content Editor
**Then** visible loading text is shown while the document fetches ("Loading your chapter…"), not a bare spinner (UX-DR12)

**Given** a course is `Published`
**When** the tutor opens the Course Content Editor on it
**Then** the document opens read-only — no "/" menu, no editable headings — with a visible banner and a link to "Take Offline" to resume editing (UX-DR12)

### Story 7.2: Chapter, Topic & Sub-Topic Structure

As a tutor,
I want to insert, edit, reorder, and delete Chapter/Topic/Sub-Topic headings via the "/" menu,
So that I can lay out my course's outline in whatever order I think of it, not a forced sequence.

**Acceptance Criteria:**

**Given** the tutor is on an empty line in the document
**When** they type "/" and select "Topic heading"
**Then** a new `h2` structural heading is inserted with a description paragraph beneath it, no minimum topic count enforced (FR-11)

**Given** a Topic heading exists
**When** the tutor inserts a "Sub-Topic heading" nested under it
**Then** a new `h3` is inserted with its own description paragraph; sub-topics remain entirely optional with no "skip" action needed (FR-3, FR-12)

**Given** a Chapter, Topic, or Sub-Topic with children
**When** the tutor deletes it
**Then** a confirm dialog states the exact count being destroyed, broken out by kind ("3 topics, 7 pages, 4 page resources, 2 node resources"), before cascading (FR-6)

**Given** the outline has multiple nodes or pages in a sibling group
**When** the tutor reorders them
**Then** both drag-and-drop and keyboard-accessible move-up/move-down controls are available (FR-7)

**Given** a Page belongs to one node
**When** the tutor moves it to a different node (drag or "Move page to…")
**Then** its own resources and body move with it, and inherited node resources shown in its Learning Resources block re-resolve against the new ancestry (FR-8)

**And** the Table-of-Contents rail auto-derives from the document's own headings (Chapter/Topic/Sub-Topic/Page marker), and activating a rail entry moves real DOM focus to the target heading, not a scroll-only jump (UX-DR7)
**And** reopening a course with an incomplete outline shows the exact same document with content intact — no "Continue setting up" affordance (FR-16)
**And** Chapter title, Topic, Sub-Topic and Page marker are real native `contenteditable` heading elements (`h1`/`h2`/`h3`/`h4` respectively) — never a styled `div` wrapping a separate input field (UX-DR1)
**And** switching from one Chapter's document to another moves focus to the newly-loaded Chapter's `h1` title, so a screen-reader user is never left positioned inside now-replaced content (UX-DR13)

### Story 7.3: Page Creation & Basic Content Blocks

As a tutor,
I want to insert Pages under any Topic or Sub-Topic and write their content using basic blocks (paragraph, sub-heading, lists, code),
So that I can put actual reading content under my outline, not just structure.

**Acceptance Criteria:**

**Given** the tutor's cursor is under a Topic or Sub-Topic heading
**When** they type "/" and select "New Page"
**Then** an `h4` structural marker is inserted carrying a title field and Confirmed/Unconfirmed badge, with the page body starting immediately below it in the same document (FR-13)

**Given** a Page exists
**When** the tutor types "/" inside its body
**Then** the menu offers Paragraph, Sub-heading, Bulleted list, Numbered list, and Code (with optional language) as insertable blocks, each compiling to Markdown `lib/markdown.ts` already renders (FR-25, FR-26 basic set, FR-27)

**And** page-body Sub-heading blocks render as `h5`/`h6`, never `h2`/`h3` — they must never collide with or be mistaken for a structural Topic/Sub-Topic heading in the document's heading tree (FR-26)
**And** blocks are reorderable by drag and by keyboard, convertible between compatible basic types (paragraph ↔ bullets ↔ numbered ↔ sub-heading), duplicable and deletable — structural headings are excluded from this conversion set (FR-29 basic types)
**And** "Preview" toggles the page between edit and rendered-as-student view, and "Markdown" shows/permits direct editing of the raw body (FR-32)
**And** raw Markdown producing constructs the block editor can't represent is preserved verbatim as an uneditable "raw" block, never silently dropped (FR-33)

### Story 7.4: Autosave & Confirmation Tracking

As a tutor,
I want every edit to save automatically with clear save-state feedback, and to see which nodes/pages still need my sign-off,
So that I never lose work and always know what's left before I can move to Review.

**Acceptance Criteria:**

**Given** the tutor is typing in any block or heading
**When** they stop typing (debounce) or blur/close the block
**Then** it autosaves with an explicit saved/saving/failed indicator; a failed save is loud, retryable, and never navigates away from unsaved content (FR-15, FR-34)

**Given** the tutor closes the editor mid-sentence on an unfinished heading
**When** they reopen the course
**Then** every character already typed is preserved, cursor position aside (FR-15, FR-16)

**Given** a node or page has only had text-only edits (Name/Description/Title/body text)
**When** those edits save
**Then** its confirmation state is preserved; a structural edit (add/delete/reorder/move a child, add/remove/re-role a resource, or a non-text body block change) resets its immediate parent to Unconfirmed (FR-44)

**And** every drag interaction has a keyboard-operable equivalent, block/outline reordering announces via `aria-live`, the outline is a proper tree with roving tabindex, and focus is never lost across autosave or block conversion (FR-47)
**And** ownership + Draft-state guards apply to every mutation, and per-course bounded limits (chapters, pages per node, resources per page, body length) are enforced server-side with clear errors (FR-48, outline/page half)
**And** Confirmed state is shown as a filled check-glyph beside the heading and Unconfirmed as an outlined circle glyph — a shape difference, never color-alone (UX-DR8)

**FRs covered:** FR1–FR17, FR25–FR27, FR29 (basic), FR32–FR34, FR44 (core), FR47, FR48 (outline/page half)

---

## Epic 8: Per-Page & Per-Node Resources

A tutor can attach pictures, PDFs, and code files to any page or node via a reusable Learning Resources block — Inline/Attachment roles, captions, ancestor inheritance, and protection against deleting a resource still referenced in page content. Delivers JTBD-5.

### Story 8.1: Learning Resources Block — Add, Role, Caption, Order

As a tutor,
I want to attach files to a page through a Learning Resources block inserted via "/",
So that a student reading this specific page finds its supporting material right there, not in one undifferentiated course-wide list.

**Acceptance Criteria:**

**Given** the tutor's cursor is inside a page body
**When** they type "/" and select "Learning Resources"
**Then** a generic, reusable resources block is inserted — the identical component this epic reuses at node level in Story 8.2 (FR-36)

**Given** the Learning Resources block is present
**When** the tutor adds a file via drag-and-drop, a file picker, or "Attach existing file" (promoting an already-uploaded source file)
**Then** all three are real, keyboard-operable controls — drag-and-drop is never the only path — and "Attach existing file" references the already-scanned file rather than re-uploading it (FR-37)

**And** every added resource gets a role — Inline, Attachment, or both — defaulting to Inline for images and Attachment otherwise, changeable afterwards via a real role control (not a static badge) (FR-38, UX-DR9)
**And** every resource has an editable display label and an optional short caption, shown to students on attachment cards (FR-39)
**And** resources are ordered within their owner via keyboard-operable reorder controls (non-drag move-up/move-down equivalent), and Attachment-role resources render to students in that order (FR-40, UX-DR9)
**And** an uploaded resource goes through the same malware-scan path as source files, rejected with its reason on failure (FR-41)
**And** **SVG sanitization (HtmlSanitizer, explicit script/event-handler/foreignObject denial) is wired into this story's upload path on Day 1** — accepted resource types are images (png/jpg/jpeg/gif/webp/svg), documents (pdf/doc/docx/txt/xls/xlsx), and the code/text extension allowlist, with per-file/per-course size caps as already enforced (FR-42, FR-48 resource half — not deferred to a later story)

**Given** an owner (a node or a page) already has 50 attached resources
**When** the tutor attempts to add a 51st
**Then** the add is rejected server-side with a clear, specific error naming the limit — never a silent failure or an unhandled exception (FR-48 resource half, Appendix A's bounded limits)

**Given** an uploaded file exceeds 25 MB
**When** the upload is attempted
**Then** it's rejected with a clear, specific error stating the size limit, before any scan/sanitize/storage work happens on it (FR-48 resource half)

### Story 8.2: Node-Level Resources & Downward Inheritance

As a tutor,
I want to attach a resource once at the Chapter/Topic/Sub-Topic level,
So that it's visible on every page beneath it without re-uploading it per page.

**Acceptance Criteria:**

**Given** a Chapter, Topic, or Sub-Topic heading
**When** the tutor types "/" and inserts a Learning Resources block directly on that heading's document position
**Then** it's the same block/component Story 8.1 built, not a separate panel reached by "selecting" a node (FR-43)

**Given** a node has an attached resource
**When** a tutor views any page nested beneath that node
**Then** the resource appears in that page's own Learning Resources block, visually muted and read-only, with a real focusable link back to the owning ancestor's block — never plain descriptive text standing in for a link (FR-36, UX-DR9)

**And** inheritance flows down only — a resource attached to a page is never visible above it, and there is no course-wide resource pool beyond the source-file list

### Story 8.3: Stable Resource References & Delete-in-Use Protection

As a tutor,
I want the system to protect a resource from deletion while it's actually used in my page content,
So that I never end up with a broken image or a dead download link a student will hit.

**Acceptance Criteria:**

**Given** a resource is referenced from a page body (an inline image or a resource card)
**When** the reference is rendered, in either the editor preview or the student player
**Then** it resolves via a stable `resource:{resourceId}` URI to a real signed/served URL at render time — never a raw storage URL baked into the Markdown (FR-30)

**Given** a resource is referenced by at least one page body
**When** the tutor tries to delete it from its Learning Resources block
**Then** the delete is blocked, naming the referencing block(s), and offers "Remove from content and delete" as an explicit second action (FR-31)

**And** **this guard is expected to be inert while this epic ships ahead of Epic 9 — no `resource:{id}` reference can exist in a page body until Epic 9's Image/Resource-card blocks land, except where a tutor hand-types a `resource:` URI via the raw-Markdown edit path (Story 7.3's FR-32/33) — cover that path in this story's tests, don't treat the guard as unverifiable until Epic 9**

**FRs covered:** FR30, FR31, FR36–FR43, FR48 (resource half)

---

## Epic 9: Rich Content Blocks — Images, Math, Callouts, Tables

A tutor can enrich a page beyond prose: inline images with required alt text, mathematical/chemical notation, callout boxes, tables, and resource-reference download cards. Completes JTBD-3 and activates Epic 8's delete-in-use guard for real page-body references.

### Story 9.1: Image Blocks with Required Alt Text

As a tutor,
I want to insert an inline image into a page and be prompted for alt text every time,
So that the image carries meaning for every student, not just the ones who can see it.

**Acceptance Criteria:**

**Given** the tutor's cursor is in a page body
**When** they type "/" and select "Image"
**Then** they can drag in or pick a file, which attaches to the page's Learning Resources block (Epic 8's mechanism) with Inline role defaulted, and inserts `![alt](resource:{resourceId})` at the cursor (FR-26, FR-30)

**Given** an image block is inserted
**When** the tutor has not yet entered alt text
**Then** the field is prompted as a first-class part of the insertion flow, not an optional attribute buried in settings (FR-35)

**And** the image renders identically in the editor preview and the student player, resolving `resource:{resourceId}` to a real served URL at render time (FR-30)

### Story 9.2: Math, Callout, Table & Resource Card Blocks

As a tutor,
I want to insert mathematical notation, callout boxes, tables, and resource-reference cards into a page,
So that a page can teach the way my subject actually needs — not just prose.

**Acceptance Criteria:**

**Given** the tutor's cursor is in a page body
**When** they type "/" and select Math
**Then** `$$…$$` fenced math is inserted and rendered via the existing KaTeX dependency (FR-26, FR-28)

**Given** the tutor selects Callout
**When** it's inserted
**Then** it emits as a blockquote with a leading `> [!note]` marker, rendered as a styled card, degrading to a plain blockquote anywhere unsupported (FR-26, FR-28)

**Given** the tutor selects Table
**When** it's inserted
**Then** it compiles to Markdown table syntax `lib/markdown.ts` already renders (FR-26)

**Given** the tutor selects Resource card
**When** it's inserted (referencing a resource already attached via Epic 8's Learning Resources block)
**Then** it emits as `[label](resource:{resourceId})`, rendered as a download card — this is the block type that gives Epic 8's Story 8.3 delete-in-use guard its first real page-body reference to protect (FR-26, FR-28, FR-30, FR-31)

**And** blocks are reorderable, convertible between compatible types (now including Callout in the conversion set), duplicable and deletable — structural headings remain excluded (FR-29 remaining)
**And** Tiptap's serializer output for these three custom block types (Math/Callout/Resource card) is tested for syntax-level round-trip parity against `lib/markdown.ts`'s parser — not just visual/pixel parity — including adjacency cases such as inline math directly beside a Callout in the same paragraph, the boundary case a hand-written parser is likeliest to mis-tokenize (frontend AD-12)

**FRs covered:** FR26 (remaining), FR28, FR29 (remaining), FR35

---

## Epic 10: Extraction from Uploaded Files

A tutor can pull text from an already-uploaded, parsed document straight into a page — whole-file or by-section — instead of retyping, with the option to also attach the source as a downloadable resource. Delivers JTBD-4.

### Story 10.1: Insert from File — Two-Pane Section Picker

As a tutor,
I want to pick a parsed source file and insert a specific section (or the whole file) into my page,
So that preparing a course is editing, not retyping something I already wrote.

**Acceptance Criteria:**

**Given** the tutor's cursor is in a page body and at least one source file has finished parsing
**When** they type "/" and select "Insert from file"
**Then** a picker lists every `Done` source file for the course, with the existing upload → scan → parse pipeline unchanged (FR-18, FR-19)

**Given** the tutor selects a source file
**When** the picker opens
**Then** it shows a two-pane selector — the parsed Markdown on the left with selectable top-level sections, and an insert preview on the right — with selection granularity of whole file or one-or-more top-level sections (FR-20)

**And** before this story merges, the section-splitting heuristic (top-level ATX heading → next heading of equal-or-higher level) is validated against real Docling output from the existing dev database, not shipped on the untested assumption FR-20's `[ASSUMPTION]` tag currently carries (OQ-4) — one validation pass against real parsed files, not a research project

**Given** the tutor selects a section and clicks Insert
**When** the text lands in the page
**Then** it's placed at the current cursor block as ordinary, fully editable Markdown blocks — unmarked, unlocked, indistinguishable from anything typed by hand (FR-21)

### Story 10.2: Attach Source as Resource & Deletion Safety

As a tutor,
I want the option to attach the file I just extracted from as a downloadable resource on the same page,
So that a curious student can get the original document, not just my edited excerpt.

**Acceptance Criteria:**

**Given** the tutor is inserting from a source file (Story 10.1)
**When** the picker is shown
**Then** it offers "Also attach this file to this page as a resource," defaulted on, which — when accepted — adds it to the page's Learning Resources block (Epic 8) as an Attachment (FR-22)

**Given** a source file has already been extracted from
**When** the tutor deletes that source file
**Then** the warning states only that it will disappear from the picker and from any page that attached it as a resource — never that already-extracted page text will change, because it will not (FR-23, DD-6)

**FRs covered:** FR18–FR23. (FR-24 — the AI structure-extraction proposal contract — is a design constraint on future, out-of-MVP work, not a story to build here; no code lands against it in this epic.)

---

## Epic 11: Confirmation Gate, Lifecycle Integration & Preview as Student

A tutor sees exactly which nodes/pages block moving a course to Review, and can preview any page/node/whole-course exactly as a student will before publishing.

### Story 11.1: Move-to-Review Confirmation Gate

As a tutor,
I want to see exactly what's blocking my course from moving to Review,
So that I know precisely what to fix instead of a generic "content not ready" message.

**Acceptance Criteria:**

**Given** any node or page in the course is Unconfirmed
**When** the tutor attempts to move the course to Review
**Then** the move is blocked and the lifecycle bar lists every blocker as a direct link into the outline (FR-45)

**Given** the confirmation-based gate is live
**When** it evaluates a Move-to-Review attempt
**Then** it fully replaces `MoveToReviewAsync`'s old file-parsed check — that check is removed outright, not kept as a redundant guard, since it's meaningless once uploaded files stop being content (FR-45, backend AD-29's neighbor)

### Story 11.2: Preview as Student

As a tutor,
I want to preview a page, a whole node, or the whole course exactly as a student will see it,
So that I catch problems before publishing, not after.

**Acceptance Criteria:**

**Given** the tutor is viewing any page, node, or the whole course
**When** they select "Preview as student"
**Then** it renders through the same component path the real student player uses — never a second, drifting renderer — at the scope selected (FR-46)

**And** the preview surface never goes through a Tiptap editor instance — reading always renders via the existing `lib/markdown.ts` (frontend AD-4/AD-9 resolution), fetching the whole chapter document in one call for node/course scope or a single page for page scope

### Story 11.3: Reviewer Access & Read-Path Authorization

As a course reviewer (Admin acting in a review capacity),
I want to read a course's outline, pages, and resources while it's In Review,
So that I can actually review what the tutor submitted, not just what's Published.

**Acceptance Criteria:**

**Given** a course is `InReview` or `ReviewConfirmed`
**When** an Admin (Master or Support) requests the outline, a chapter document, or a resource
**Then** access is granted via the existing JWT + `FeatureAuthorizationHandler` policy pattern — no distinct "Reviewer" role exists in this codebase; reviewer access **is** Admin access (backend AD-29)

**Given** a course is `Draft`
**When** anyone other than the owning tutor requests its content
**Then** access remains denied exactly as it is today (`EnsureOwnedDraftAsync`)

**And** real-student read access to a genuinely `Published` course (as opposed to the tutor's own "Preview as student") requires an enrollment check that does not exist anywhere in the domain model yet — this story ships the reviewer/admin branch only; the student branch defaults to deny until an Enrollment primitive exists (backend AD-29, tracked in Deferred, not this epic's scope to design)

### Story 11.4: Real Student Reading via Course Player

As a student,
I want the Course Player to render a Page's actual content and its inline resources,
So that once I'm able to reach a published course, what I see is the real thing, not a broken renderer.

**Acceptance Criteria:**

**Given** a student is navigating a course in Course Player (existing per-topic/subtopic drilldown pattern)
**When** they reach a node with authored Pages
**Then** `ReaderCanvas.tsx` fetches each Page's body via `courseContentService.getPage(pageId)` — one page at a time, matching the existing navigation pattern, never a whole-chapter fetch — and renders it through the existing `lib/markdown.ts` renderer, never a Tiptap instance (frontend AD-4/AD-9 resolution)

**Given** a Page body contains a `resource:{resourceId}` reference (inline image or resource card)
**When** it renders in Course Player
**Then** it resolves to a real served URL via `courseContentService.resolveResourceUrl()` — the same function Story 11.2's tutor-facing Preview as Student uses (FR-30)

**And** this story builds the read mechanism itself, independent of who's allowed to call it — live access remains gated closed by Story 11.3's deny-by-default policy until a real Enrollment primitive exists in a future epic; this is not blocked on that work, it's what that future work will flip open
**And** this is a distinct code path from Story 11.2's "Preview as Student" — different auth (real student vs. owning tutor), different fetch pattern (per-page vs. whole-chapter), different failure modes (a real student can hit a 403 a previewing tutor never will) — not a shared feature just because both render through `lib/markdown.ts`

**FRs covered:** FR45, FR46, FR44 (lifecycle integration), FR30 (student-player half)
