---
title: Tutor Content Authoring — Document Canvas, Pages & Per-Page Resources
status: draft
created: 2026-08-16
updated: 2026-08-16
supersedes_partially: prd-eLearning-2026-08-10 §4.3, §4.4 (Content Upload & AI Structure Extraction; Tutor Validation & Editing)
---

# PRD: Tutor Content Authoring — Document Canvas, Pages & Per-Page Resources

**Revision note (2026-08-16):** §4.2 originally specified a discrete 4-step wizard (Chapter →
Topics → Sub-Topics → First page, with Back/Next and a step indicator). UX Discovery on this PRD
validated a different interaction model with the user across three mock rounds — a single,
continuous, Confluence/Notion-style document per Chapter, authored via a "/" slash-command menu —
now the spine of record in `ux-eLearning-2026-08-10/EXPERIENCE.md`. This revision brings the PRD
in line with that validated UX; every "wizard"/"step"/"block palette"/"Resources panel" reference
below has been rewritten, not just relabeled — see DD-4 for the replacement decision.

## 0. Document Purpose

This PRD scopes the next expansion of the **Course Content Editor**: turning it from a
read-only view of parsed file text into the surface where a tutor actually *authors* a course —
a single flowing document per Chapter that walks Chapter → Topic → Sub-Topic as document
headings, a **Page** as the unit of authored content, a "/" slash-command menu for inserting
Markdown-backed blocks (prose, bullets, code, images, math) and structure alike, and a
**per-page resource library** so every page owns its own pictures, PDFs, code files and
attachments.

It is written for the engineer(s) who will build it, and for the tutors who will use it. It is
grounded in what is in `main` today, not in what earlier stories once shipped — see §1.1, which
matters because a previous content-tree implementation was removed and this PRD deliberately
does **not** restore it unchanged.

FRs are numbered locally to this document (FR-1 … FR-48). Named design decisions are DD-1 …
DD-7 and are the load-bearing part of this document — an FR that contradicts a DD is a bug in
this PRD, not a licence to improvise. Data model and API surface sketches live in Appendix A/B;
story slicing in Appendix C.

---

## 1. Vision

A tutor arrives at the Course Content Editor having already told FlexDemy *what* the course is —
name, board, class, subject, tags, thumbnails — through the Course Metadata Wizard. What they
cannot do today is tell FlexDemy *what is in it*. They can upload a PDF and watch its text
appear. That is a preview, not authoring: the tutor cannot say "this is Chapter 2, here is what
you will learn, here is the worked example, and here is the reference sheet to download."

This PRD gives the tutor that voice. Content is authored as a sequence of **Pages** hung on a
three-level outline (Chapter → Topic → Sub-Topic), and the whole thing — outline and pages alike
— lives in **one continuous document per Chapter**, not a multi-step form: the Chapter title is
the document's own heading, Topics and Sub-Topics are headings inside it, and a Page is a marked
section within a heading's span. A "/" slash-command menu (or an equivalent "+" click affordance)
is the single mechanism for inserting anything — a new Topic heading, a new Page, a paragraph, an
image — so a tutor never leaves the document to "add" something. Each page is composed from
blocks inserted the same way (paragraph, bullets, code, image, callout, table, math), all of which
are just Markdown underneath. Each page — and each Chapter/Topic/Sub-Topic — owns its own resource
shelf via a reusable **Learning Resources** block: the picture that renders inline, the PDF a
curious student can download, the `.py` file the worked example refers to. And uploaded documents
stop being the content — they become a **source** the tutor extracts text *from*, into a page,
where the tutor then arranges it.

The through-line: **the tutor decides the shape of every page.** Parsing and AI extraction propose;
the tutor disposes. Nothing renders to a student that a tutor did not place on a page.

### 1.1 What exists today (verified against `main` @ `245d803`)

| Capability | State |
| --- | --- |
| Course metadata, taxonomy, tags, thumbnails, lifecycle (Draft→Review→Confirmed→Published) | Built. `Course`, `CourseThumbnail`, `LifecycleState`, `CoursesController`, `CourseWizard/`, `PublishLifecycleBar.tsx` |
| Multi-file upload, ClamAV scan, secure storage, Docling parse to Markdown | Built. `CourseFile` (`ParsedContent`), `CourseFilesController` (`POST/GET/GET {id}/download/DELETE`), `useFileUpload.ts` |
| Course Content Editor shell — file chips with status, dropzone, per-file Viewer/Code tabs, maximise/restore | Built. `CourseContentEditor.tsx` (492 lines) |
| Hand-rolled Markdown renderer (headings, lists, tables, fenced code, blockquote, inline code/bold/italic/link) that never emits raw HTML | Built. `lib/markdown.ts`, `ui/MarkdownViewer.tsx` |
| KaTeX available for math | Dependency present (`katex ^0.18.1`), used by `CoursePlayer/renderLatex.ts` |
| **`Chapter` / `Topic` / `Subtopic` / `ContentBlock` entities, `ContentTreeController`, `useCourseContentTree.ts`, `ContentTreeNode.tsx`** | **Removed in commit `f3131d9` ("fetch in Div").** Not present in `Domain/Courses/`, `Application/Courses/`, `Api/Controllers/`, or `FrontEnd/src/`. Story 2.9's spec remains on disk as history. |
| AI `extractStructure` staging (`ExtractedStructureJson`, `IsMaterialized`) | Removed alongside the tree in the same commit |
| AdaptiveLearning / Exercise application slice, `AiGateway` (`IAiGateway`, `IAiTaskGateway`, `AiTaskGateway`) | **Also removed in `f3131d9`** — the same commit did more than remove the content tree. FR-24's "where the AI structure-extraction pipeline is reinstated" depends on this gateway infrastructure, which does not currently exist and is not scoped by this PRD. |
| `PublishService.cs`, `VersionService.cs` | **Substantially rewritten in `f3131d9`** (159 and 199 lines changed respectively). Their current behavior operates on `CourseFile.ParsedContent`; see OQ-8 for the open question this raises about the new Page/Resource graph. |

**DD-1 — This PRD re-introduces the outline, it does not revert `f3131d9`.**
Chapter / Topic / Sub-Topic come back because a course needs an outline. `ContentBlock` does
**not** come back. The row-per-block model is replaced by `Page` (§4.5) with a Markdown body,
which is a strictly simpler storage shape and the one the existing renderer already speaks. Story
2.9's spec is useful as a reference for ordering, cascade-delete and confirmation-reset mechanics
(Appendix A cites it) — it is not the target design.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **JTBD-1.** As a tutor, I need to lay out my course as chapters, topics and sub-topics, so a
  student meets it in a deliberate order instead of as a pile of uploaded documents.
- **JTBD-2.** As a tutor, I need to tell a student up front what a chapter will give them, so they
  know why they are reading it.
- **JTBD-3.** As a tutor, I need each page to mix the right kinds of content — an explanation, a
  bulleted summary, a code sample, a diagram, a formula — because a page that is only prose does
  not teach the subjects I teach.
- **JTBD-4.** As a tutor, I need to pull text out of a document I already wrote and rearrange it
  into pages, so preparing a course is editing rather than retyping.
- **JTBD-5.** As a tutor, I need each page to carry its own pictures and downloadable extras, so a
  student who wants more depth on *this* page finds it on *this* page — not in one undifferentiated
  course-wide file list.
- **JTBD-6.** As a tutor, I need to stop mid-course and pick up exactly where I left off, because I
  build a course over several sittings, not one.
- **JTBD-7.** As a tutor, I need to see a page as a student will see it before I publish it.

### 2.2 Non-Users (v1)

- **Students** are affected by the output (§4.11) but never open this surface.
- **Admins** have no role here — this is not an admin screen and adds no Admin sub-tab.
- **Co-authors.** A course has exactly one owning tutor (`Course.TutorId`). Multi-tutor
  co-authoring, review comments and per-node assignment are explicitly out (§5).

### 2.3 Key User Journeys

**UJ-1 — Meera builds Chapter 1 from scratch (the empty document).**
*Context:* Meera teaches CBSE Class 10 Science. Her course metadata is saved; she is in Draft.
*Path:* She opens the Course Content Editor. The outline is empty, so the editor opens **one
empty document**, cursor active on the Chapter-title heading — not a wizard step, not an empty
tree with an ambiguous "+" button. She types the **Chapter name** directly ("Chemical Reactions
and Equations"), presses Enter, and writes the **chapter overview** as an ordinary paragraph —
the placeholder guidance frames it as *what a student will get from this chapter*. She types "/",
picks **Bulleted list**, and adds two "what you'll learn" points. On a new line she types "/",
filters to **Topic heading**, and inserts one — types "Chemical Equations" — then repeats for
"Types of Reactions" and "Corrosion and Rancidity", each followed by a one-line description
paragraph. Under "Types of Reactions" she types "/" again and inserts a **Sub-Topic heading**
("Combination Reactions"); she leaves "Chemical Equations" and "Corrosion and Rancidity" with no
sub-topics — sub-topics are optional, and nothing forces her to add one.
*Climax:* Still inside the document, under "Combination Reactions," she types "/" and inserts a
**New Page**, titles it, writes a paragraph, types "/" for **Bulleted list** and adds three
points, types "/" for **Image**, drags in `combination-reaction.png`, and writes alt text. She
types "/" once more and inserts a **Learning Resources** block scoped to this page — it now shows
that image.
*Resolution:* She switches to **Preview** and sees the page exactly as a student will. She types
"/" and inserts another **New Page** to keep going. Everything has been autosaving per block since
her very first keystroke; nothing was lost when her laptop slept mid-sentence.
*Edge case:* She closes the editor mid-sentence on an unfinished Topic heading. Reopening shows
the exact same document — cursor position lost, but every typed character preserved (per-block
autosave, not a step-completion save point). There is no "Continue setting up" affordance, because
there was never a step to resume, only a document to reopen.

**UJ-2 — Meera builds Chapter 2 from a PDF she already wrote (the extraction path).**
*Context:* She has `Acids-Bases-Salts.pdf`, already uploaded and parsed.
*Path:* On a new Chapter 2 document, she inserts a Topic heading and a New Page under it. On an
empty line inside that page she types "/" and picks **Insert from file**. A picker lists the
course's parsed files; she picks the PDF and sees its parsed Markdown in a two-pane selector —
left: the source, with selectable sections; right: what will be inserted. She selects the "Acids"
section only and clicks **Insert**.
*Climax:* The text lands in the page body at her cursor as ordinary, fully editable Markdown
blocks — no different from anything she typed by hand. She deletes a stray parser artefact,
promotes a line to a heading via "/", converts a run of lines to bullets, and drags a paragraph
above a code block.
*Resolution:* She repeats for "Bases" on a second Page. The picker's **Also attach this file to
this page as a resource** option (defaulted on) has already added the PDF to page 1's Learning
Resources block as an **Attachment**, so a student can download the original too.
*Edge case:* Two months later she re-uploads a corrected PDF. **The pages she already authored do
not change** — extraction is copy-on-insert (DD-6). She re-extracts into a new page if she wants
the corrections.

**UJ-3 — Meera attaches per-page depth.**
On the "Corrosion" page she types "/" and inserts a Learning Resources block, attaching
`rusting-experiment.pdf` as an **Attachment** (a student sees a download card at the bottom of the
page) and `corrosion-diagram.png` as **Inline** (rendered in place, via an Image block referencing
the same resource). On the *Chapter* heading itself, she inserts a second Learning Resources block
and attaches the syllabus PDF once — it shows on every page beneath the chapter as a muted,
read-only inherited resource with a real link back to the Chapter's block, without being
re-uploaded per page.
*Edge case:* She deletes `corrosion-diagram.png` from the page's own Learning Resources block
while its reference is still in the page body. The editor blocks the delete with "used in this
page's content" and offers **Remove from content and delete** (FR-31).

**UJ-4 — Meera reviews and publishes.**
She uses **Preview as student** on a whole chapter, walks it page by page, confirms each node, and
moves the course to Review. Unconfirmed nodes are listed on the lifecycle bar as blockers.

---

## 3. Glossary

- **Outline** — The Chapter → Topic → Sub-Topic hierarchy of one course. Structure only; it holds
  no rendered body content.
- **Node** — Any one Chapter, Topic or Sub-Topic. Every node has a Name and a Description.
- **Description (of a node)** — The tutor's short "what you'll get from this" text. Chapter-level
  is the *chapter overview* (JTBD-2); topic/sub-topic-level are one-to-three-line orientations.
- **Page** — The unit of authored content and the unit of reading. A page belongs to exactly one
  node, has a title, and has a Markdown body. Content lives on pages, never on nodes (DD-2).
- **Block** — One editable unit inside a page body: paragraph, sub-heading, bullet/numbered list,
  code, image, callout, table, math, divider, resource card. A block is an **editing affordance**,
  not a storage row (DD-3). Distinct from a **structural heading** (below) — a block never carries
  outline meaning of its own.
- **Structural heading** — The document heading that *is* a Chapter title, Topic, Sub-Topic or Page
  marker (real `h1`/`h2`/`h3`/`h4` elements respectively — DD-4). Unlike a page-body Heading block
  (which is just a sub-heading inside prose, `h5`/`h6`), a structural heading carries outline
  identity: deleting or moving it deletes or moves everything nested under it.
- **Page body** — The canonical Markdown document for one page. What blocks compile to and parse
  back from.
- **Resource** — A file attached to a node or a page: image, PDF, code file, document.
- **Resource role** — `Inline` (rendered in the page body where referenced) or `Attachment`
  (listed as further reading / downloadable). A single resource may be both.
- **Learning Resources block** — The generic, reusable section that holds a node's or page's
  resources. The same block type whether inserted on a Chapter, a Topic, a Sub-Topic, or inside a
  Page's body — never a fixed, app-chrome-only "resources panel" (DD-4, §4.5).
- **Source file** — An uploaded, parsed `CourseFile`. The thing a tutor extracts *from*. A source
  file is not itself content (DD-5).
- **Extraction** — Copying selected parsed Markdown from a source file into a page body, once, as
  editable content (DD-6).
- **"/" slash-command menu** — The filterable, categorized menu (opened by typing "/" on an empty
  line, or its "+" click equivalent) that inserts *anything* — a new Topic heading, a new Page, or
  an ordinary content block — through one mechanism (DD-4).
- **Document / Canvas** — The single, continuous, always-editable surface for one Chapter: its
  title, its Topics/Sub-Topics as structural headings, and every Page nested within them, all in
  reading order. There is no separate "wizard mode" and "workspace mode" — a course with an empty
  outline and a course with forty pages are the same kind of surface, just at different lengths.
- **Confirmation** — Per-node/per-page tutor sign-off (`Unconfirmed` / `Confirmed`), a publish
  precondition. **Not the same concept as the existing course-level `LifecycleState.ReviewConfirmed`**
  (a reviewer-driven, course-scoped state) — the two are unrelated actors at unrelated granularities
  that happen to share a word; see OQ-7 for the reconciliation this collision requires.

---

## 4. Features

### 4.1 The authoring model

**DD-2 — Nodes are containers; pages are content.**
A Chapter/Topic/Sub-Topic carries a Name, a Description, an optional cover image and resources.
It never carries a body. Every word a student reads lives on a Page. This is what keeps "where do
I put this paragraph?" from being ambiguous at four levels, and it makes the student reader a page
sequence keyed to outline position — not a recursive tree renderer — with each node's own
Description surfacing exactly once, as that node's opening card ahead of its first page (FR-5),
rather than nodes recursively containing rendered sub-content.

**DD-3 — A page body is one Markdown document. Blocks are an editing affordance, not storage.**
The editor inserts and manipulates blocks via the "/" slash-command menu (§4.2's DD-4); it persists a single Markdown string.
Rationale: (a) the renderer that already exists (`lib/markdown.ts`) consumes exactly this;
(b) it makes copy/paste, extraction, export and diffing trivial; (c) it avoids re-litigating the
row-per-block model that was removed in `f3131d9`; (d) an unsupported construct degrades to text
rather than to a broken row. Cost, accepted: block identity is positional, so a
block-level comment/anchor feature would need this revisited — it is out of scope (§5).
`[ASSUMPTION (A-4): no consumer of course content requires stable block identity — true today,
falsifiable by a future per-block comment/anchor/analytics feature.]`

- **FR-1.** A course has an ordered list of Chapters. A Chapter has an ordered list of Topics. A
  Topic has an ordered list of Sub-Topics. Depth is fixed at three; there is no fourth level.
- **FR-2.** A Page attaches to exactly one node, which may be a Chapter, a Topic **or** a
  Sub-Topic. Pages are ordered within their node.
- **FR-3.** Sub-Topics are optional. A Topic with pages and no sub-topics is a complete, valid,
  publishable structure.
- **FR-4.** Every node has: Name (required, ≤ 200 chars), Description (optional, ≤ 2 000 chars,
  Markdown-lite: paragraphs and bullets only), optional cover image, ordered resources,
  confirmation state.
- **FR-5.** A node's Description renders to students as a section-opening card before that node's
  first page (§4.11) — it is content the student sees, not private authoring notes.
- **FR-6.** Deleting a node cascades to its descendants, their pages, and every resource owned by
  the node itself or by any descendant node or page (node-owned resources are included in the
  cascade exactly like page-owned ones — both are `Resource` rows per Appendix A). Delete is
  confirm-gated and states the exact count being destroyed, broken out by kind
  ("3 topics, 7 pages, 4 page resources, 2 node resources").
- **FR-7.** Nodes and pages reorder within their sibling group via drag-and-drop **and** via
  keyboard-accessible move-up/move-down controls (FR-47).
- **FR-8.** A page can be moved to a different node in the same course (outline drag, or a
  **Move page to…** action). Its own resources and body move with it; inherited node resources
  shown in its Learning Resources block are re-resolved against the new ancestry. This re-resolution does
  **not** rewrite the page body: if the body contains an in-place `resource:{resourceId}` reference
  (FR-30) to a resource that was only visible via the *old* ancestry, that reference is not fixed up
  and becomes a broken reference after the move — see OQ-13, which this PRD leaves open rather than
  silently assuming away.

### 4.2 The authoring canvas — one document, inserted via "/"

**DD-4 — Authoring is one continuous document; there is no separate wizard mode.**
*Supersedes this PRD's original DD-4 ("the wizard scaffolds; it does not imprison"), which
specified a discrete 4-step wizard (Chapter → Topics → Sub-Topics → First page, Back/Next, a step
indicator). UX Discovery validated a different, simpler model with the user directly, across three
mock rounds — see `ux-eLearning-2026-08-10/EXPERIENCE.md`'s "ContentAuthoring PRD · UJ-1" Key
Flow, which is now the canonical description of this flow.* A Chapter is a single flowing
document: its title is the document's own `h1`; Topics (`h2`), Sub-Topics (`h3`) and Pages (`h4`,
§4.4) are structural headings inside it, in reading order; ordinary content blocks (paragraph,
image, table, …) sit in the same document. **One mechanism inserts everything** — a "/"
slash-command menu opened by typing "/" on an empty line, or an equivalent always-available "+"
click affordance (the accessible primary entry — "/" is a shortcut layered on top of it, never the
only path). There is no wizard to finish, no step to advance past, and no boundary between
"scaffolding" and "the real editor" — a brand-new empty Chapter and a Chapter with forty Pages are
the same kind of surface, just at different lengths. Rationale: a tutor's second Chapter does not
need a guided tour any more than their fifth Page does, and every keystroke already writes through
via the same per-block autosave (FR-34) regardless of what's being typed.

- **FR-9.** When a course has an empty outline, the Course Content Editor opens on **one empty
  document**, cursor active on the Chapter-title heading, rather than a wizard step or an empty
  tree with an ambiguous "+" button.
- **FR-10.** **Chapter.** The Chapter title is the document's `h1`, typed directly or completed via
  "/". Immediately below it, the tutor writes the chapter overview as an ordinary paragraph block —
  placeholder guidance frames it as *"What will a student get from this chapter?"* — and may insert
  an optional repeatable **"What you'll learn"** bullet list (`/` → Bulleted list). A cover image
  and chapter-level Learning Resources block (§4.5) may be inserted here or added later — nothing
  about this Chapter's document changes shape depending on what's filled in yet.
- **FR-11.** **Topics.** Inserted via "/" (**Topic heading**) at the point in the document a tutor
  wants one, as an `h2` with a description paragraph beneath it. No minimum count is enforced by
  the editor — a Chapter with zero Topics is simply an incomplete document, not a blocked step; §7's
  M-1 measures whether tutors get past this point in practice, which is the real signal a hard
  "at least one topic required" gate would only approximate.
- **FR-12.** **Sub-Topics.** Inserted via "/" (**Sub-Topic heading**) nested under a Topic heading,
  as an `h3` with its own description paragraph. Entirely optional — nothing prompts for one, and
  nothing needs an explicit "skip" action, because there is no step to skip.
- **FR-13.** **Pages.** Inserted via "/" (**New Page**) under a Topic or Sub-Topic heading, as an
  `h4` structural marker (§4.4) carrying a title and per-page Confirmed/Unconfirmed state. Writing
  a Page's body is not a hand-off to a different surface — it's the same document, same insertion
  mechanism, immediately below the marker.
- **FR-14.** The "/" menu is fully keyboard-operable (Arrow Up/Down to highlight, Enter to commit,
  Escape to cancel), and the "+" click affordance is visible on hover *and* keyboard focus, not
  hover-only — full contract in `EXPERIENCE.md`'s Accessibility Floor. There is no step indicator,
  because there are no steps; the lifecycle bar (§4.6) remains the one persistent orientation
  element in the header.
- **FR-15.** Every insertion and every edit persists on its own block-blur (§4.7's autosave, FR-34)
  — not on completing a step, because there is no step to complete. Closing the editor mid-sentence
  on an unfinished heading keeps every character already typed.
- **FR-16.** Reopening a course with an incomplete outline (a Chapter with no Topics, a Topic with
  no Pages and no Sub-Topics) shows the exact same document, cursor position lost but content
  intact — not a "Continue setting up" affordance, because there was never a step to resume, only
  a document to reopen (§6.3's migration concerns a separate, pre-existing-content scenario, not
  this one).
- **FR-17.** **Add chapter** inserts a new empty document the same way FR-9 describes the first
  one. Every other creation — topic, sub-topic, page, block, resource — goes through the same "/"
  or "+" mechanism described above; there is no separate "direct inline create" path distinct from
  it, and no wizard to re-enter.

### 4.3 Source files and extraction

**DD-5 — An uploaded file is a source, not content.**
Today's editor renders `CourseFile.ParsedContent` directly as the course's content. After this
PRD it does not: parsed text is shown only inside the **Insert from file** picker, and only page
bodies render to students. Rationale: this is the whole premise of tutor-controlled authoring
(JTBD-4). Migration consequence is real and named in §6.3.

**DD-6 — Extraction is copy-on-insert, never a live link.**
Once inserted, text belongs to the page. Re-parsing, re-uploading or deleting the source file
never rewrites, invalidates or removes page content. Rationale: a tutor who has spent an hour
editing extracted text must never have it clobbered by a background job; and there is no realtime
sync mechanism in this codebase (WebSockets are Deferred in the architecture spine). Cost, accepted:
this creates unflagged staleness — if a tutor re-uploads a corrected source file (UJ-2's edge
case), the page(s) already extracted from the old version keep rendering to students unchanged,
with no "source file changed since extraction" indicator anywhere in the editor. The weaker,
cheaper alternative this PRD is implicitly rejecting — a non-destructive staleness notice on
affected pages — is deferred rather than built (OQ-15), not silently assumed unnecessary.

- **FR-18.** The existing upload → scan → parse pipeline is unchanged. The Uploaded Files strip
  (chips with Queued/Parsing/Done/Failed, retry, delete, drag-and-drop) stays exactly as built.
- **FR-19.** The page editor offers **Insert from file**, listing every `Done` source file for the
  course.
- **FR-20.** The picker shows the file's parsed Markdown in a two-pane selector: source (left,
  with selectable top-level sections) and insert preview (right). Selection granularity for v1 is
  **whole file or one or more top-level sections** — not arbitrary character ranges.
  `[ASSUMPTION: section = a top-level ATX heading and everything until the next one of equal or
  higher level, derived by the existing lib/markdown.ts block parser. Confirm against real Docling
  output during dev.]`
- **FR-21.** Insert places the selected Markdown at the current cursor block in the page body, as
  ordinary editable blocks. Nothing about the inserted text is marked, locked or specially styled.
- **FR-22.** The picker offers **Also attach this file to this page as a resource**, defaulted
  **on** for the file being extracted from (it is almost always the thing a student would want to
  download too).
- **FR-23.** Deleting a source file after extraction is allowed and warns only that it will
  disappear from the picker and from any page that attached it as a resource — never that page
  text will change, because it will not.
- **FR-24.** Where the AI structure-extraction pipeline is reinstated, it produces a **proposal**
  the tutor accepts, edits or discards — it never writes nodes or pages directly. Out of scope for
  this PRD's MVP (§6.2); FR-24 exists to fix the contract now so a later story cannot quietly make
  extraction authoritative.

### 4.4 The page editor

- **FR-25.** A page has a Title (required, ≤ 200 chars) and a body.
- **FR-26.** The "/" slash-command menu (§4.2's DD-4) offers, at minimum, these content blocks:
  **Paragraph, Sub-heading, Bulleted list, Numbered list, Code, Image, Callout, Table, Math,
  Divider, Resource card** — plus, at the appropriate nesting point, the structural **Topic
  heading / Sub-Topic heading / New Page** entries from §4.2 and the **Learning Resources** block
  from §4.5, all in the same menu (DD-4: one mechanism inserts everything). Every content block
  compiles to Markdown the existing `lib/markdown.ts` renderer already supports, except Callout,
  Math and Resource card — see FR-28. **A page-body "Sub-heading" block is `h5`/`h6`, never
  `h2`/`h3`** — those levels are reserved for the structural Topic/Sub-Topic headings (DD-4); a
  page-body sub-heading is ordinary prose structure (e.g. breaking a long page into sections), not
  outline structure, and must not collide with or be mistaken for one in the document's heading
  tree.
- **FR-27.** A Code block carries an optional language, emitted as the fenced-code info string.
- **FR-28.** Three block types need renderer work, and this is scoped as part of the feature, not
  assumed away:
  - **Math** — `$$…$$` fenced math, rendered via the KaTeX dependency already present.
  - **Callout** — emitted as a blockquote with a leading marker (`> [!note]`), rendered as a
    styled card, degrading to a plain blockquote anywhere unsupported.
  - **Resource card** — emitted as a link with a `resource:` URI (FR-30), rendered as a download
    card.

  `[ASSUMPTION (A-3): the existing lib/markdown.ts subset covers every palette block except these
  three, and extending it for math/callout/resource card is bounded work.]`
- **FR-29.** Blocks are reorderable by drag and by keyboard (FR-47), convertible between
  compatible types (paragraph ↔ bullets ↔ numbered ↔ sub-heading ↔ callout), duplicable and
  deletable. Structural headings (Topic/Sub-Topic/Page — §4.2) are not part of this conversion set;
  converting a structural heading's *type* is a move/promote/demote operation on the outline, not a
  block-type swap, and is out of scope for v1 (§5).
- **FR-30.** **Resource references are stable IDs, never storage URLs.** An inline image is
  `![alt](resource:{resourceId})`; a resource card is `[label](resource:{resourceId})`. Resolved
  to a real signed/served URL at render time, both in the editor preview and the student player.
  Rationale: storage paths change, resources get re-uploaded, and a raw URL in a Markdown body is
  both unmovable and a broken-link generator. It is also what makes FR-31's "is this resource in
  use?" check a simple, exact string scan rather than a guess.
- **FR-31.** Deleting a resource that is referenced by its page body is blocked, with the
  referencing block(s) named, and offers **Remove from content and delete** as an explicit second
  action.
- **FR-32.** **Preview** toggles the page between edit and rendered-as-student view. A **Markdown**
  view shows the raw body and permits direct editing of it — the same Viewer/Code duality the
  current `FileContentCard` already establishes, applied to pages.
- **FR-33.** Editing raw Markdown that produces constructs the block editor cannot represent is
  preserved verbatim and shown as an uneditable-in-blocks "raw" block, never silently dropped.
- **FR-34.** **Autosave.** The page body saves on a debounce after typing stops and on blur/close,
  with an explicit saved/saving/failed indicator. A failed save is loud, retryable, and never
  navigates away from unsaved content.
- **FR-35.** Alt text is a first-class, prompted field on every image block, not an optional
  attribute buried in settings (this is a learning product; images carry meaning).

### 4.5 Per-page (and per-node) resources

**DD-7 — Resources are owned by one node or page, and visible down the tree, never up.**
A resource attached to a Chapter is visible on every page under it. A resource attached to a page
is visible only there. There is no course-wide resource pool beyond the source-file list.
Rationale: this is exactly the tutor's stated need — "manage each page's resources separately" —
while still letting a syllabus PDF be attached once rather than seven times.
`[ASSUMPTION (A-5): inheritance flows down only, with no per-page suppression list — deferred
unless asked for, see OQ-5.]`

- **FR-36.** A page's resources live in a **Learning Resources block** (§3 Glossary), inserted via
  "/" like any other block, listing that page's own resources and, read-only and visually
  distinguished, resources inherited from its ancestor nodes. This is a generic, reusable block
  type, not a fixed sidebar-only panel — the identical component is what FR-43 uses at node level.
- **FR-37.** A resource is added to a Learning Resources block by drag-and-drop, by file picker, or
  by promoting an existing course source file (**Attach existing file**) — the last of which
  references the already-uploaded, already-scanned file rather than re-uploading it. All three are
  real, keyboard-operable controls; drag-and-drop is never the only path.
- **FR-38.** Every resource has a **role**: `Inline`, `Attachment`, or both. Role is set at attach
  time (defaulting to `Inline` for images, `Attachment` for everything else) and is changeable
  afterwards.
- **FR-39.** Every resource has an editable display label and an optional short caption/description
  ("what this is for"), shown to students on attachment cards.
- **FR-40.** Resources are ordered within their owner; `Attachment`-role resources render to
  students in that order (§4.11).
- **FR-41.** Uploaded resources go through the same malware-scan and secure-storage path as source
  files. A resource that fails scanning is rejected with its reason and never attaches.
- **FR-42.** Accepted resource types for v1: images (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`),
  documents (`pdf`, `doc`, `docx`, `txt`, `xls`, `xlsx`), and code/text files: `py`, `js`, `ts`,
  `jsx`, `tsx`, `java`, `c`, `cpp`, `cs`, `go`, `rb`, `php`, `html`, `css`, `json`, `xml`, `sql`,
  `sh`, `yaml`, `yml`, `md` (also listed in Appendix A).
  `[ASSUMPTION (A-7): this code/text extension list is this PRD's proposal, not previously specified —
  confirm against real tutor-submitted content at story time — OQ-9.]`
  Per-file and per-course size caps as already enforced for uploads.
- **FR-43.** Node-level resources use the same Learning Resources block (FR-36), inserted via "/"
  directly on the Chapter/Topic/Sub-Topic heading's own document position, rather than a
  panel reached by separately "selecting" a node.

### 4.6 Confirmation, lifecycle and preview

- **FR-44.** Confirmation semantics, carried forward from the removed Story 2.9 and re-affirmed
  here: a **text-only** edit (node Name/Description, page Title/body text) **preserves**
  confirmation; a **structural** edit (add/delete/reorder/move a child, add/remove/re-role a
  resource) **resets** the immediate parent to `Unconfirmed`. A page's own confirmation resets on
  any structural change to its body's non-text blocks (image, resource card, math, table). A page
  move (FR-8) touches two nodes and the page itself at once: `[ASSUMPTION (A-8): moving a page resets
  both the source and destination immediate parent to Unconfirmed, and resets the moved page's own
  confirmation too, since its inherited-resource ancestry changed under it — this specific case
  was not spelled out by the removed implementation and is this PRD's proposal. Confirm at story
  time — OQ-12.]`
  `[ASSUMPTION: the exact text-only boundary for page bodies is this PRD's proposal; the removed
  implementation drew it at "Text and Lang only". Confirm at story time.]`
- **FR-45.** **Move to Review** is blocked while any node or page is `Unconfirmed`, and the
  lifecycle bar lists the blockers as direct links into the outline. This replaces a generic
  "content not ready" message and **replaces** the file-parsed check `MoveToReviewAsync` currently
  performs — that check is meaningless once DD-5 makes uploaded files non-content, and this PRD's
  intent is for confirmation status to be the sole gate. See OQ-7 for the reconciliation this needs
  against the code as it exists today, including what happens to any course currently `InReview`
  or `Confirmed` under the old file-parsed gate. Once a course is `InReview`, `EnsureOwnedDraftAsync`'s
  Draft-only guard (FR-48) blocks further tutor edits by construction; reviewer rejection therefore
  requires `ReturnToDraftAsync` (already in the lifecycle) before the tutor can act on feedback.
  This PRD does not change whether returning to Draft resets any node/page confirmation — see
  OQ-14.
- **FR-46.** **Preview as student** is available at page, node and course scope, rendering through
  the same component path the student player uses — not a second, drifting renderer.

### 4.7 Cross-cutting requirements

- **FR-47.** **Accessibility.** Every drag interaction has a keyboard-operable equivalent; block
  and outline reordering announce via `aria-live` (extending the existing batched-announcement
  pattern in `CourseContentEditor.tsx`); the outline is a proper tree with roving tabindex; alt
  text is prompted (FR-35); focus is never lost across autosave or block conversion.
- **FR-48.** **Safety and scale.** The Markdown renderer's no-raw-HTML guarantee is preserved
  end-to-end — nothing in this PRD introduces `dangerouslySetInnerHTML`. This guarantee extends to
  uploaded file content, not just rendered Markdown: an uploaded `svg` resource (FR-42) is
  sanitized server-side (script elements, event-handler attributes and external references
  stripped) before storage, so an inline or attached SVG cannot carry executable content — the
  exact sanitization mechanism is an architecture decision, not fixed here (OQ-10). Ownership +
  Draft-state guards apply to every mutation, exactly as `CourseFileService` already does. Bounded
  limits per course (chapters, pages per node, resources per page, body length) are enforced
  server-side with clear errors, not left unbounded (Appendix A). *Story slicing note:* this FR is
  cross-cutting rather than owned by one story — the ownership/Draft-guard and bounded-limits half
  applies to C-1/C-2/C-3, and the no-raw-HTML/SVG-sanitization half applies to C-3 (upload) and
  C-4/C-7 (render).

---

## 5. Non-Goals (Explicit)

- **Co-authoring, comments, review threads, per-node assignment.** One owning tutor, one editor.
- **Real-time collaborative editing.** No WebSockets (Deferred in the architecture spine); last
  write wins within a single tutor's own sessions.
- **A WYSIWYG rich-text engine.** Blocks compile to Markdown (DD-3). No arbitrary inline styling,
  fonts, colours or free-form layout.
- **Arbitrary-depth outlines.** Three levels, fixed (FR-1).
- **Block-level anchors, per-block comments or per-block versioning.** Directly precluded by DD-3.
- **Video, audio or embedded-iframe blocks.** Not in the resource allowlist for v1.
- **Question/exercise authoring.** Exercises are AI-generated in a separate epic.
- **Cross-course content reuse / a content library.** Resources and pages belong to one course.
- **Importing an existing course structure from a file's table of contents automatically.** That is
  FR-24's AI proposal, out of MVP.
- **Editing published content in place.** Publishing/versioning behaviour is unchanged by this PRD.
  `[ASSUMPTION (A-9): "unchanged" assumes PublishService/VersionService's existing snapshot/restore logic
  extends mechanically to the new outline/page/resource graph the way it currently handles
  CourseFile-based content. Both services were substantially rewritten in f3131d9 and neither has
  been verified against this PRD's new entities — see OQ-8, which is a genuine open scope question,
  not a formality.]`

---

## 6. MVP Scope

### 6.1 In scope

DD-1 … DD-7, FR-1 … FR-23, FR-25 … FR-48. In shipping terms:

1. Outline (Chapter/Topic/Sub-Topic) with names, descriptions, ordering, cascade delete, confirmation.
2. Single-document authoring canvas with a "/" slash-command menu inserting outline structure
   (Chapter/Topic/Sub-Topic/Page) and content blocks through one mechanism, per-block autosave.
3. Page CRUD, ordering, move-between-nodes.
4. "/"-driven page editor over a Markdown body, with Preview / Markdown duality and autosave.
5. Renderer additions: math, callout, resource card (FR-28).
6. Per-page and per-node resources with roles, inheritance, in-use protection.
7. Insert-from-file extraction, whole-file or by-section.
8. Lifecycle integration: confirmation blockers on Move to Review; Preview as student.

### 6.2 Out of scope for MVP (named, not forgotten)

- AI structure proposal (FR-24) — the contract is fixed now, the feature lands later.
- Reinstating `ExtractedStructureJson` / `IsMaterialized` staging.
- Arbitrary-range extraction selection (beyond whole-file / by-section).
- Bulk operations (multi-select delete, bulk move, bulk confirm).
- Page templates or a starter-outline library.
- Export of a whole course to Markdown/PDF.

### 6.3 Migration and the existing-content question

**This is the one genuinely disruptive consequence and it needs a product decision, not an
engineering default.** Today, a course's student-visible content *is* its parsed source files
(§1.1). After DD-5, it is its pages. Courses that already exist in Draft with parsed files and no
pages will render as empty.

`[NOTE FOR PM]` **Migration is not merely "blocking for §6.3."** DD-5's behavior change and the
backfill are not independently shippable: if the outline/page features (which include DD-5) ship
to production before whichever backfill option below is built, any existing Draft course with
parsed files and no pages goes blank in production during that gap. Appendix C currently lists the
migration story (C-11) last, dependent on C-9. Either C-11 ships atomically with the DD-5-carrying
stories, or DD-5's behavior sits behind a flag until backfill is ready — this PRD does not yet say
which, and sequencing this incorrectly is a real production incident, not a rough edge (OQ-16).

Three options, in the order I'd recommend them:

1. **One-time, tutor-triggered backfill (recommended).** For any course with parsed files and an
   empty outline, offer a single **Build a starting outline from my files** action that creates
   one Chapter per source file and one Page per top-level section, with the parsed text inserted.
   The tutor then edits. Honest about what it is (a starting point), reuses FR-20's section
   splitter, and requires no silent data transformation. `[ASSUMPTION (A-6): this recommendation is
   contingent on FR-20's section-splitting heuristic (itself flagged [ASSUMPTION] and tied to
   OQ-4) holding up against real Docling output — if it doesn't, a one-time bulk backfill produces
   a bad starting outline for every migrated course at once, a larger blast radius than a single
   mis-split page in ordinary authoring. Validate the splitter against production-shaped documents
   before committing to option 1.]`
2. **Automatic backfill on first open.** Same transformation, no consent. Faster, but it invents
   a structure and stamps it as the tutor's.
3. **No backfill.** Correct only if no real Draft courses with parsed content exist yet — a
   question about the actual database, answerable before this ships (§8, OQ-1).

---

## 7. Success Metrics

- **M-1.** ≥ 80% of tutors who begin typing into a new Chapter's empty document reach at least one
  authored Page in the same session (measures whether the empty-document-plus-"/" first pass is
  actually completable, replacing the old wizard-completion signal with the equivalent one for a
  step-free canvas).
- **M-2.** ≥ 60% of authored pages contain at least one non-paragraph block (measures whether the
  "/" slash-command menu's block set is discoverable, i.e. whether JTBD-3 was actually served or
  the tutor just typed prose).
- **M-3.** ≥ 50% of pages on courses that have source files were created via Insert from file
  (measures whether extraction beats retyping — JTBD-4).
- **M-4.** ≥ 40% of pages carry at least one page-scoped resource (measures JTBD-5).
- **M-7 (counter-metric to M-3).** ≥ 70% of pages created via Insert from file receive at least one
  edit beyond the extraction itself before the page is first confirmed (guards against M-3 being
  satisfied by insert-and-never-edit, which would score well on M-3 while quietly defeating DD-6's
  "the tutor disposes" premise).

  `[NOTE FOR PM]` M-2, M-3, M-4 and M-7 are stated as bare percentages with no defined measurement
  window, cohort, or denominator-refresh rule (unlike M-1 and M-6, which specify "same session" and
  a concrete failure rate). Pick one before these are used to adjudicate ship/no-ship — e.g. rolling
  30-day window over pages in courses that have reached at least Review, recomputed weekly.
- **M-5.** Median sessions-to-first-publish ≤ 3, with ≥ 70% of multi-session courses resumed via
  Continue rather than restarted (measures JTBD-6 / FR-16).
- **M-6.** Zero content-loss reports attributable to autosave, and < 0.5% of saves failing
  unrecovered (FR-34 is a trust feature; anything else makes the whole surface unusable).

---

## 8. Open Questions

- **OQ-1.** Do real Draft courses with parsed files exist in production/staging today? Determines
  which §6.3 migration option ships. **Blocking for §6.3 only** — every other part of this PRD can
  be built while it is open.
- **OQ-2.** Should a page be publishable individually, or only as part of a whole-course publish?
  This PRD assumes whole-course, matching the existing lifecycle.
- **OQ-3.** Does a Chapter with pages directly on it (FR-2 allows it) have a use case worth
  keeping, or should pages be topic/sub-topic-only? Allowing it is cheap; forbidding it later is
  a breaking change, so this PRD allows it.
- **OQ-4.** Is the section-splitting rule in FR-20's `[ASSUMPTION]` correct against real Docling
  output across the parsed files already in the dev database?
- **OQ-5.** Should inherited node resources be *hideable* per page (a tutor who doesn't want the
  syllabus PDF on one specific page)? Deferred unless asked for — adds a suppression list.
- **OQ-6.** `[NOTE FOR PM]` Confirmation granularity: is per-page confirmation genuinely useful to
  tutors, or does per-node suffice? Per-page is proposed (FR-44) because a page is the unit of
  reading, but it is more clicks before publish.
- **OQ-7.** How does FR-45's new confirmation-based Move-to-Review gate reconcile with the
  file-parsed check `CourseService.MoveToReviewAsync` performs today? FR-45 states the confirmation
  gate replaces it, but doesn't say what happens to any course currently `InReview` or `Confirmed`
  under the old gate, or whether the old check is removed outright vs. kept as a redundant guard
  during a transition period. **Blocking for FR-45's implementation.**
- **OQ-8.** Does `PublishService`/`VersionService`'s existing snapshot/restore logic actually extend
  to the new outline/page/resource graph the way §5 assumes ("Publishing/versioning behaviour is
  unchanged by this PRD")? Both services were substantially rewritten in `f3131d9` around
  `CourseFile`-shaped content and have not been verified against Chapter/Topic/Subtopic/Page/
  Resource. **Blocking for architecture** — this PRD's entire purpose is to define what a student
  ultimately reads, and silence on how that gets captured at publish time is a scope gap, not an
  implementation detail to defer.
- **OQ-9.** Is FR-42's proposed code/text extension allowlist (Appendix A) the right one for what
  tutors actually upload? Unverified — confirm against real usage at story time.
- **OQ-10.** What is the actual SVG sanitization mechanism for FR-48's extended no-raw-HTML
  guarantee (library, strip-vs-reject policy, whether inline `<style>`/CSS is also stripped)? This
  PRD fixes the requirement, not the mechanism — architecture's call.
- **OQ-11.** What is the authorization model for student and reviewer read-access to outline/page/
  resource content once a course leaves Draft? Appendix B's API surface is entirely
  `EnsureOwnedDraftAsync`-gated; nothing describes the read path FR-46 ("Preview as student") and
  ordinary published-course consumption actually need. **Blocking for architecture.**
- **OQ-12.** Does moving a page (FR-8) reset confirmation on both its source and destination
  immediate-parent nodes, and on the page's own confirmation? FR-44 proposes yes for all three;
  confirm at story time.
- **OQ-13.** When a page moves to a node it can no longer see a previously-inherited resource
  through, should the editor detect and warn about the now-broken in-body `resource:` reference
  (FR-8), block the move, or ship v1 accepting silently-broken references as a known limitation?
- **OQ-14.** Does `ReturnToDraftAsync` (the reviewer-rejection path) reset any node/page
  confirmation, or does a rejected course re-enter Draft with all prior confirmations intact?
  UJ-4 only shows the happy path to Review; the reviewer-rejection path is otherwise unaddressed.
- **OQ-15.** Should a page whose source file has been re-uploaded since extraction show a
  non-destructive "source file changed since extraction" staleness notice? DD-6 deliberately keeps
  extraction copy-on-insert; this asks only about a passive notice, not re-sync.
- **OQ-16.** Must the migration story (Appendix C, C-11) ship atomically with — or strictly before —
  the DD-5-carrying stories, or does DD-5's behavior need a flag until backfill is ready? See the
  `[NOTE FOR PM]` under §6.3. **Blocking for release sequencing**, independent of which backfill
  option OQ-1 resolves to.

---

## 9. Assumptions Index

- **A-1** (FR-20) Section splitting derives from top-level ATX headings via the existing block
  parser. Unverified against real Docling output at scale — OQ-4.
- **A-2** (FR-44) The text-only/structural boundary for page bodies as drawn here is a proposal,
  not carried verbatim from the removed implementation.
- **A-3** (§4.4) The existing `lib/markdown.ts` subset covers every palette block except math,
  callout and resource card, and extending it for those three is bounded work (FR-28).
- **A-4** (DD-3) No consumer of course content requires stable block identity. True today; would
  be falsified by a future per-block comment/anchor/analytics feature.
- **A-5** (§4.5) Resource inheritance flows down only, with no per-page suppression — OQ-5.
- **A-6** (§6.3) Migration option 1 is preferred; the recommendation is contingent on OQ-1 **and**
  on FR-20's section-splitting heuristic (A-1) holding against real Docling output — validate
  before committing.
- **A-7** (FR-42) The code/text resource extension allowlist is this PRD's proposal, not previously
  specified — confirm against real tutor-submitted content — OQ-9.
- **A-8** (FR-44) Moving a page resets both the source and destination immediate-parent nodes to
  `Unconfirmed`, and resets the moved page's own confirmation — not spelled out by the removed
  implementation — OQ-12.
- **A-9** (§5 Non-Goals) "Publishing/versioning behaviour is unchanged by this PRD" assumes
  `PublishService`/`VersionService` extend mechanically to the new content graph; unverified against
  either service post-`f3131d9` — OQ-8.

---

## Appendix A — Data model sketch

Per `BackEnd/CLAUDE.md`: POCOs in `Domain/Courses/`, `IEntityTypeConfiguration<T>` in
`Infrastructure/Persistence/Configurations/`, DTO-only service boundaries, `IIdGenerator.NewId()`
for ids, one `SaveChangesAsync` per use case.

```
Chapter   : AuditableEntity   CourseId, Name, Description, CoverImageResourceId?, Order,
                              Confirmation                 → Topics, Pages, Resources
Topic     : AuditableEntity   ChapterId, Name, Description, CoverImageResourceId?, Order,
                              Confirmation                 → Subtopics, Pages, Resources
Subtopic  : AuditableEntity   TopicId, Name, Description, CoverImageResourceId?, Order,
                              Confirmation                 → Pages, Resources
Page      : AuditableEntity   OwnerType {Chapter|Topic|Subtopic}, OwnerId, Title,
                              BodyMarkdown (text), Order, Confirmation  → Resources
Resource  : AuditableEntity   OwnerType {Chapter|Topic|Subtopic|Page}, OwnerId,
                              CourseFileId? (when promoted from an existing source file),
                              FileName, ContentType, SizeBytes, StoredUrl,
                              Role {Inline|Attachment|Both}, Label, Caption, AltText?, Order,
                              ScanStatus
```

Notes, each of which is a decision rather than an incidental:

- **`Page.OwnerType`/`OwnerId` is a polymorphic parent, not three nullable FKs.** Three levels can
  own a page; three nullable columns with an "exactly one must be set" app invariant is the shape
  Story 2.9 used for `ContentBlock` and it was a documented source of validation burden. Same
  choice for `Resource`, which has four possible owners. Cost: no DB-level FK cascade — cascade is
  a service-layer responsibility (and must be tested as such).
- **`Order`** is an explicit contiguous `0..n-1` int per sibling group, renumbered on delete and
  move — copy `CourseService.ReorderThumbnailAsync` / `RemoveThumbnailAsync`, which are the
  working precedent in this codebase; swap by list index, never by arithmetic on `Order` values.
- **`Resource.CourseFileId`** is set when a resource is promoted from an existing source file
  (FR-37) so the same bytes are not stored twice; `null` for a directly-uploaded resource.
- **`BodyMarkdown`** is unbounded Postgres `text` at the column level with an application-level cap
  (proposed 256 KB/page) enforced in the service — the same posture `CourseFile.ParsedContent` took.
- **Suggested bounded limits (FR-48):** 100 chapters/course, 100 topics/chapter, 50
  sub-topics/topic, 200 pages/node, 50 resources/owner, 25 MB/resource.
- **Code/text resource extension allowlist (FR-42):** `py`, `js`, `ts`, `jsx`, `tsx`, `java`, `c`,
  `cpp`, `cs`, `go`, `rb`, `php`, `html`, `css`, `json`, `xml`, `sql`, `sh`, `yaml`, `yml`, `md` —
  proposal, unverified against real usage (OQ-9).
- **This appendix is a sketch, not binding on the architecture phase.** `IContentRepository`
  shape, the `Order`-as-contiguous-int convention and the `Confirmation` enum ordinal choice are
  implementation precedent cited for continuity with this codebase, not product requirements —
  architecture may revise them with justification.
- **Confirmation** is `enum { Unconfirmed = 0, Confirmed = 1 }` — `Unconfirmed` deliberately
  ordinal 0 so the CLR default matches the DB default (the EF Core omission bug Story 2.4 hit with
  `LifecycleState`).
- **One `IContentRepository` for the whole outline**, not five per-entity repositories — every real
  operation (reorder within a sibling group, cascade delete, resolve "what type is this id",
  move a page across owners) is inherently cross-entity, exactly as Story 2.9 argued.

## Appendix B — API surface sketch

`[Route("api/v1/courses/{courseId}/content")]`, `[Authorize(Policy = FeatureKeys.CoursesCreate)]`,
every action behind the same `EnsureOwnedDraftAsync(courseId)` guard `CourseFileService` uses.

**Gap, named rather than assumed away:** every route below — including `GET /resources/{id}/content`,
which serves the actual bytes — is scoped to the owning tutor's own Draft course. Nothing here
describes how a student (FR-46's "Preview as student," and ordinary consumption of a Published
course) or a reviewer reads the same outline, pages and resources once the course leaves Draft.
The authoring routes below are this PRD's scope; the read-path for non-owner/non-Draft consumption
is a distinct, unaddressed surface — see OQ-11.

```
GET    /outline                          → full outline + page stubs (no bodies)
POST   /chapters                         → 201 ChapterDto
POST   /topics            {chapterId}    → 201 TopicDto
POST   /subtopics         {topicId}      → 201 SubtopicDto
PATCH  /nodes/{id}        {name?, description?, coverImageResourceId?}   → 204
DELETE /nodes/{id}                       → 204   (cascades; returns nothing, warns client-side)
POST   /nodes/{id}/reorder {direction}   → 204
POST   /nodes/{id}/move    {targetId}    → 204
POST   /nodes/{id}/confirm               → 204

POST   /pages             {ownerType, ownerId, title}  → 201 PageDto
GET    /pages/{id}                       → 200 PageDto (with body)
PATCH  /pages/{id}        {title?, bodyMarkdown?}      → 204   (autosave target, FR-34)
DELETE /pages/{id}                       → 204
POST   /pages/{id}/move   {ownerType, ownerId, index}  → 204
POST   /pages/{id}/confirm               → 204

GET    /resources         ?ownerType&ownerId&includeInherited → 200 ResourceDto[]
POST   /resources         (multipart: file, ownerType, ownerId, role, label?, caption?, altText?)
                                         → 201 ResourceDto
POST   /resources/attach-existing  {courseFileId, ownerType, ownerId, role} → 201 ResourceDto
PATCH  /resources/{id}    {role?, label?, caption?, altText?}  → 204
DELETE /resources/{id}    ?force=true    → 204 | 409 with referencing page ids (FR-31)
POST   /resources/{id}/reorder {direction} → 204
GET    /resources/{id}/content           → the bytes; the target `resource:` URIs resolve to

GET    /sources                          → parsed CourseFiles available for extraction (FR-19)
GET    /sources/{fileId}/sections        → parsed section outline for the picker (FR-20)
```

Enum wire format follows this codebase's existing PascalCase `.ToString()` convention
(`"Confirmed"`, `"Inline"`) — if the frontend wants lowercase unions, the translation belongs in
the frontend service layer, as Story 2.9 established.

## Appendix C — Suggested story slicing

| # | Story | Depends on |
| --- | --- | --- |
| C-1 | Outline domain, persistence, repository, service, controller (FR-1…FR-8, confirmation FR-44) | — |
| C-2 | Page domain + CRUD + move + autosave endpoint (FR-2, FR-25, FR-34) | C-1 |
| C-3 | Resource domain, upload/scan reuse, roles, inheritance, in-use guard (FR-36…FR-43, FR-31) | C-1 |
| C-4 | Renderer extensions: math, callout, resource card, `resource:` URI resolution (FR-28, FR-30) | — (parallel) |
| C-5 | Table-of-Contents rail UI: auto-derived from document headings, drag + keyboard reorder, cascade-delete confirms, real-focus activation (FR-6, FR-7, FR-47) | C-1 |
| C-6 | Document canvas shell + "/" slash-command menu component: keyboard/ARIA contract (combobox/listbox, Tab semantics, zero-match state), "+" click affordance, structural-heading insertion (Topic/Sub-Topic/New Page), post-insert focus + announcement (FR-9…FR-17). **Shared component** — C-7 and C-8 both insert through this same menu, not a separate one each. | C-1, C-2, C-5 |
| C-7 | Page editor content blocks: the "/" menu's content-block set (paragraph, sub-heading, image, code, table, math, callout…), conversion, reorder, Preview/Markdown duality, autosave UI (FR-26…FR-35) | C-6, C-4 |
| C-8 | Learning Resources block UI: generic insertable block (chapter/topic/sub-topic/page, inserted via C-6's menu), attach, drag-drop, roles, inherited section, in-use dialog (FR-36…FR-43) | C-3, C-6 |
| C-9 | Insert-from-file: source list, section picker, two-pane selector, insert (FR-18…FR-23) | C-7 |
| C-10 | Lifecycle integration: confirmation blockers, Preview as student at 3 scopes (FR-45, FR-46) | C-7 |
| C-11 | Migration: the §6.3 option chosen by OQ-1 | C-9 |

C-4 has no dependencies and can run in parallel from day one. C-1 → C-5 → C-6 is the critical path.

FR-48 is cross-cutting rather than owned by a single story (see FR-48's story-slicing note): its
ownership/Draft-guard and bounded-limits half is an acceptance criterion on C-1/C-2/C-3, and its
no-raw-HTML/SVG-sanitization half is an acceptance criterion on C-3 (upload) and C-4/C-7 (render).
