---
title: New Course Wizard — AI-Assisted Course Creation & Adaptive Learning Module
status: final
created: 2026-08-10
updated: 2026-08-11
---

# PRD: New Course Wizard — AI-Assisted Course Creation & Adaptive Learning Module

## 0. Document Purpose

This PRD scopes the New Course Wizard: an AI-assisted flow that turns a tutor's raw material (PDF/Word/TXT/Excel) into a structured, publish-ready course, and an adaptive learning module that lets a student understand any topic at the depth and in the style that suits them. It is written for whoever builds and reviews this work, and for the architecture and UX passes that follow it. It builds on, and **supersedes**, `prd-eLearning-2026-08-10` ("Dashboard — Role-Aware Merge") **FR-18**, which described the existing 4-step Course Creation Wizard prototype (`FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx`): a client-only, flat Title → Assets → Lessons → Review shell with no AI extraction and no Chapter/Topic/Subtopic structure. This document replaces that flow end to end. It also reuses two pieces of existing prior art rather than rebuilding them: the taxonomy step (§4.2, FR-8) wires into the existing admin-governed taxonomy system (`FrontEnd/src/features/Admin/MasterDataManager.tsx`, `services/masterDataService.ts`), and the five-level drill-down UI (§4.6, FR-17) wires AI generation behind the existing `FrontEnd/src/features/CoursePlayer/DrilldownPanel.tsx` component, which today renders static mock data. Per this repo's convention, FR numbering restarts at FR-1 for this document; where it cites the Dashboard PRD's requirements it says so explicitly ("Dashboard PRD's FR-18").

This PRD's single most important requirement is architectural, not features-list — see §4.1: every AI-driven capability in this module must sit behind one internal, provider-agnostic AI service layer, so the model powering the module is a configuration choice, not a code dependency.

Gateway options considered, free-tier/pricing research, and further repo prior-art detail live in the companion `addendum.md` — read it before the architecture pass; it is not repeated here.

## 1. Vision

Today, a tutor turns source material into a course by hand: typing out lessons one at a time into a flat list, with no help structuring the material and no way to teach the same idea at more than one depth or in more than one way. A student, in turn, gets whatever single explanation the tutor happened to write — if it doesn't click, there's nothing else to try except asking a human.

The New Course Wizard changes both sides of that. A tutor uploads what they already have — a textbook chapter, a slide deck, a worksheet — and the AI proposes a structured outline (Chapters → Topics → Subtopics → Content) that the tutor edits and confirms rather than authoring from a blank page. A student opens any topic and gets it the simplest way first, with the ability to go one level deeper at a time, or try a completely different explanation and worked example if the first one doesn't land — plus optional practice and instant, click-to-explain definitions for any unfamiliar term.

The underlying AI is treated as a replaceable engine, not a foundation poured in concrete: development runs on free or cheap models, and at launch — or any time after — the module can be pointed at the best-performing model for each specific task purely through configuration, with no application rewrite.

## 2. Target User

### 2.1 Jobs To Be Done

**Tutor / Creator**
- When I have existing material (a chapter, slides, notes), I want the system to draft a course structure for me, so I'm editing rather than building from a blank page.
- When the AI gets something wrong or incomplete, I want full control to add, edit, delete, and reorder before anything goes live, so the published course is accurate.
- When I'm ready to publish, I want to see exactly what a student will see first, so I catch problems before a student does.

**Student**
- When I don't understand something, I want the simplest possible explanation first, so I'm not overwhelmed.
- When the simplest explanation isn't enough, I want to go deeper on my own terms, one step at a time.
- When an explanation just doesn't click for me, I want a completely different way of hearing the same idea, so I'm not stuck with one framing.
- When I hit an unfamiliar word mid-lesson, I want to tap it and get an answer immediately, without losing my place.
- When I want to check my understanding, I want to practice, so I know whether it actually landed.

**Admin**
- When I manage the tag and taxonomy vocabularies, I want them clean and duplicate-free, so search and filtering stay reliable for tutors and students.
- When a new AI model becomes available or a provider has an outage, I want to change which model powers a given task from a config screen, so the module never depends on one vendor being up.

### 2.2 Non-Users (v1)

- Students building their **own** course structure (course creation is tutor-only in v1).
- Institutions wanting bulk/API course import (single-tutor, wizard-driven upload only in v1).
- Anyone needing auto-graded, high-stakes assessment (§6.2, §5) — exercises here are practice, not certification.

### 2.3 Key User Journeys

*Structured from the wizard flow and adaptive-learning mechanics described in the source draft; not independently narrated by the user this session — treat as `[ASSUMPTION]` on specific beats and confirm before UX work begins.*

- **UJ-1. Meera turns a scanned chemistry chapter into a structured course.**
  - **Persona + context:** Meera, a chemistry tutor for CBSE Class 10, has a scanned PDF of her own printed notes and no time to retype them.
  - **Entry state:** Authenticated as Tutor, mid-wizard, having just completed Title/Tags/Taxonomy/Thumbnails.
  - **Path:** She drags the scanned PDF into the upload step; a per-file progress bar shows "Uploading → Parsing → Extracting." Because the PDF is scanned (not digital-born), the system runs an OCR/parsing pass before the AI proposes structure `[ASSUMPTION: surfaced to Meera only as a status label, not a technical detail]`. Within a couple of minutes the tree appears: 3 chapters, 11 topics, a handful of subtopics, each populated with extracted content and a chemical-formula rendering that matches her original notation.
  - **Climax:** She reviews the tree, fixes one mis-split topic by dragging a subtopic under the correct parent, edits a garbled OCR sentence, and taps **Confirm** on each node.
  - **Resolution:** All nodes confirmed; the "Review as Student" action is now enabled.
  - **Edge case:** One page of the PDF fails to parse (corrupted scan). Only that file/section shows a failed status with a retry action — the rest of her structure is untouched and she can keep working.

- **UJ-2. Aarav doesn't get momentum the first time, and finds it a second way.**
  - **Persona + context:** Aarav, a Class 9 student, opens a physics topic on momentum the night before a test.
  - **Entry state:** Authenticated as Student, inside a published course, viewing a Topic page at its default (Level 1) explanation.
  - **Path:** He reads the Level 1 explanation — still doesn't click. He taps "Explain a different way," and cycles through the 5 alternative explanations until one uses a car-crash analogy that makes sense to him, complete with its own worked example.
  - **Climax:** The analogy lands; he taps a bolded keyword ("inertia") inline and gets a one-line, subject-aware popover definition without leaving the page.
  - **Resolution:** Confident on the core idea, he opens the optional exercise attached to the topic to check himself before closing the app.
  - **Edge case:** If a topic has no exercise attached (tutor didn't add one), the practice action simply doesn't appear — no broken state.

- **UJ-3. Rohan swaps the production model for one task without touching code.**
  - **Persona + context:** Rohan, the platform admin, notices the current drill-down model is producing shallow Level 4/5 explanations and a stronger reasoning model has just become available.
  - **Entry state:** Authenticated as Admin, on the AI Configuration screen (§4.13, FR-27).
  - **Path:** He selects "Drill-down (5 levels)" from the task list, changes its assigned model, saves.
  - **Climax:** The next drill-down generation for any course uses the new model — no deploy, no code change.
  - **Resolution:** Cost/usage dashboard (FR-28) begins reflecting the new model's per-task spend from that point forward.

- **UJ-4. Meera reviews her own course exactly as a student would before publishing.**
  - **Persona + context:** Meera has confirmed every node in her chemistry course and wants to see it live before students do.
  - **Entry state:** Authenticated as Tutor, all nodes confirmed, "Review as Student" now enabled.
  - **Path:** She enters student-preview mode: drills down a level, cycles an alternative explanation, attempts the practice exercise, clicks a keyword.
  - **Climax:** Everything renders and behaves as intended; she taps **Confirm Review**.
  - **Resolution:** **Publish** becomes enabled for the first time in this course's lifecycle.

## 3. Glossary

- **Course** — The top-level publishable unit a tutor creates: metadata (title, tags, taxonomy, thumbnails) plus a content tree.
- **Chapter** — The top level of a course's content tree, containing one or more Topics.
- **Topic** — A child of a Chapter, containing zero or more Subtopics and/or Content Blocks. Topics and Subtopics are the units that carry the adaptive-learning mechanisms (Drill-Down, Alternative Explanations, Exercises, Keywords).
- **Subtopic** — A child of a Topic, same adaptive-learning capabilities as a Topic.
- **Content Block** — The leaf unit of extracted/authored material inside a Topic or Subtopic (text, equation, image, table, etc.).
- **Tag** — A label selected from the admin-governed Tag list (§4.12) and attached to a Course; free-text tags are not permitted.
- **Taxonomy** — The admin-governed, cascading academic classification (Country → State → City → Board → Class Level → Subject) attached to a Course via the existing MasterDataManager system.
- **AI Service Layer** ("the gateway") — The single internal abstraction (§4.1) through which all AI-driven capability in this module is invoked; feature code never calls a vendor SDK directly.
- **AI Task** — A named unit of AI work routed through the gateway (e.g. `extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`), each independently configurable to a provider/model.
- **Drill-Down Level** — One of 5 progressive depth levels (1 = simplest, 5 = most rigorous) of the *same* explanation for a Topic/Subtopic (§4.6).
- **Way** — One of 5 alternative explanations of the *same* Topic/Subtopic, each with its own worked example (§4.7); distinct from a Drill-Down Level.
- **Exercise** — An optional, practice-only (non-certifying) activity attached to a Topic/Subtopic (§4.8).
- **Keyword Definition** — An on-demand, context-aware definition surfaced when a student clicks a keyword inline (§4.9).
- **Lifecycle State** — One of `Draft`, `In Review`, `Review Confirmed`, `Published` (§4.11); governs what actions are available on a Course. `Publishing` is a transient sub-state entered from `Review Confirmed` while FR-21's generation batch runs, before the course reaches `Published` — not a fifth Lifecycle State a course can be left in.
- **Master Data** — Admin-governed reference data (Taxonomy values, Tags) that feature surfaces consume but do not directly mutate.

## 4. Features

### 4.1 AI Service Layer — Pluggable Backbone

**Description:** A single internal AI-service layer sits between all feature code and every AI provider. Feature code calls generic, named AI Tasks (`extractStructure()`, `explainTopic(level)`, `rewriteExplanation(way)`, `generateExercise()`, `defineKeyword()`, `describeNotation()`) and never knows or cares which vendor/model answered. This is the PRD's central requirement — every other AI-driven feature (§4.3, §4.5–§4.9) is built as a caller of this layer, never as a direct integration. `describeNotation()` was added during the UX accessibility review: it generates screen-reader alt-text for rendered math/chemistry notation (FR-16), a first-class budgeted pipeline step rather than an unbacked accessibility claim. `[ASSUMPTION: implemented as an OpenAI-compatible gateway, self-hosted from day one per cost review (a free, zero-markup OSS gateway, not a managed paid-fee service) — exact product deferred to build time; see FR-2]`.

**Functional Requirements:**

#### FR-1: Provider-agnostic AI gateway

Feature code (frontend and backend) can invoke AI capability only through the internal AI Service Layer; no feature module calls a vendor AI SDK directly.

**Consequences (testable):**
- A code-review/lint check (or equivalent architectural test) fails a PR that imports a vendor AI SDK outside the gateway module.
- Every AI Task listed above resolves to a provider/model at request time via gateway config, not a hardcoded value in feature code.

#### FR-2: Configuration-only provider/model swap

Admin can change the active provider/model for a given AI Task (§4.13, FR-27) and have it take effect without an application redeploy of feature code.

**Consequences (testable):**
- Changing a task's model in AI Configuration affects the next request for that task with no code deployment.
- **Revised in cost review:** the gateway is a self-hosted, zero-markup OpenAI-compatible proxy (e.g. Portkey's open-source gateway, Apache-licensed) from day one — not a managed-gateway phase followed by a later self-hosted migration. A managed gateway (OpenRouter-class) charges a real platform fee (a percentage on top of provider costs); self-hosting the free OSS gateway from the start avoids that fee entirely, requires no later migration, and gives the same data-residency benefit the original phase-2 migration was for, from day one. `[ASSUMPTION: exact self-hosted gateway product deferred to build time — see §8]`.
- A locally-run, self-hosted model (e.g. an Ollama-class runtime) is a selectable backend for any AI Task through the same gateway config — not a separate integration — giving zero-cost, zero-rate-limit, fully private dev-phase inference as an alternative to a free cloud tier. Applies to embeddings (§4.1 AI Task list) as well as generative tasks.
- The gateway's config store supports runtime (DB/API-driven) updates to provider/model/threshold settings, not file-based config requiring a process restart — so this FR's "no redeploy" guarantee (and FR-29's) holds from day one, not just after a later migration that no longer happens.

#### FR-3: Per-task model selection and cross-provider fallback

The gateway supports assigning a different model per AI Task, and retries on an alternate provider when the primary is rate-limited or unavailable.

**Consequences (testable):**
- Two different AI Tasks can be configured to two different models simultaneously.
- A simulated primary-provider failure (429/5xx) results in a successful response from the configured fallback provider, not a user-facing error.
- Every fallback event is logged and flagged via FR-4's usage tracking — so a run of fallback-served generations (e.g. `explainTopic` silently served by a weaker backup model) is visible to the admin who configured the primary model, not just "no user-facing error."

#### FR-4: Token usage and cost tracking per task

The gateway records token usage and computed cost for every AI Task invocation, attributed to the task and (where applicable) the course/tutor that triggered it.

**Consequences (testable):**
- Admin's usage/cost view (FR-28) can be filtered by AI Task and by date range.
- Free-tier dev usage is tracked with the same mechanism as paid usage, so cost-per-topic (SM-5) is measurable across both phases.

#### FR-5: Centralized, versioned prompt and model configuration

Prompts and model/provider config for every AI Task live in one centralized, versioned location, not scattered across feature code.

**Consequences (testable):**
- A prompt change for one AI Task does not require touching feature-module code.
- Prompt/config changes are attributable to a version (who changed what, when) for rollback.

**Feature-specific NFRs:**
- Dev-phase free/cheap-tier usage is restricted to providers that do not train on submitted input whenever real-ish student content is used (e.g. a Groq-class provider); providers whose free tier trains on input by default (e.g. Google AI Studio's free tier outside EU/UK/EEA) are usable only with synthetic, non-student content. `[ASSUMPTION: specific provider list to be verified at build time against then-current terms — see §8]`.

---

### 4.2 Course Creation Wizard — Metadata Steps

**Description:** A four-step metadata flow (Title → Tags → Taxonomy → Thumbnails) precedes content upload (§4.3). This supersedes Dashboard PRD's FR-18 in full. Each step validates before the next is enabled; the draft auto-persists throughout. Realizes UJ-1.

**Functional Requirements:**

#### FR-6: Course Title step

Tutor enters a required, single-line Course Title (trimmed, non-empty, max length enforced `[ASSUMPTION: exact character limit not specified — recommend 120 chars, confirm before build]`) and an optional short description/subtitle.

**Consequences (testable):**
- Advancing past this step is blocked while Title is empty or whitespace-only.
- Title is trimmed of leading/trailing whitespace on save.

#### FR-7: Tags step

Tutor selects zero or more Tags from a searchable, type-ahead multi-select populated from the admin-governed Tag list (§4.12); free-text tag entry is not available.

**Consequences (testable):**
- The tag picker offers only active tags; deactivated tags do not appear as selectable options.
- A tag already deactivated after being attached to this course remains attached (does not silently drop) but cannot be re-selected if removed.

#### FR-8: Academic Taxonomy step (reuses MasterDataManager)

Tutor selects Country → State → City → Board → Class Level → Subject via cascading dropdowns backed by the existing admin-governed master data (`masterDataService.ts`); each child selector is disabled until its parent is chosen. Country, Board, Class Level, and Subject are required to advance; whether State and City are required is board-dependent — decided per-board via the master data itself (e.g. a national board doesn't need a State/City requirement the way a state board does), not a single blanket rule.

**Consequences (testable):**
- Selecting/changing a parent value clears and reloads the dependent child selector's options.
- Advancing is blocked while any required taxonomy field is unset.
- A Board flagged as not requiring State/City in master data allows advancing without them selected; a Board flagged as requiring them blocks advancing until both are set.

**Out of Scope:** Building new taxonomy admin CRUD — already delivered by the existing MasterDataManager system; this step only consumes it.

#### FR-9: Thumbnails step

Tutor uploads up to 3 thumbnail images (JPG/PNG/WEBP `[ASSUMPTION: exact size cap not specified — recommend 5MB/file, confirm before build]`), cropping each to a fixed aspect ratio client-side before it's accepted (`[ASSUMPTION: exact ratio not specified — recommend 16:9, confirm before build]`), with preview, reorder, delete, and set-primary actions.

**Consequences (testable):**
- An uploaded image that isn't already the required aspect ratio must be cropped via the in-step crop tool before it's accepted into the thumbnail list.
- Every thumbnail across every course renders at the same aspect ratio in the course-card grid — no letterboxing or stretching.
- Upload of a 4th thumbnail is rejected with a clear message while 3 are already present.
- Exactly one thumbnail is marked primary at any time once at least one exists.

#### FR-10: Step progression, validation, and draft auto-persistence

The wizard shows a progress indicator across all steps (metadata + content, §4.3), validates the current step before enabling "Next," and auto-persists wizard state as a Draft (Lifecycle State, §4.11) after every step.

**Consequences (testable):**
- Closing the browser mid-wizard and returning resumes at the last-completed step with prior input intact.
- No step can be skipped via direct navigation while its own validation is unmet.

---

### 4.3 Content Upload & AI Structure Extraction

**Description:** The tutor uploads source files; the system parses and, via the AI Service Layer, proposes a Chapter → Topic → Subtopic → Content structure mapped from that content. Realizes UJ-1.

**Functional Requirements:**

#### FR-11: Multi-file upload with per-file progress

Tutor uploads one or more files (PDF, .doc/.docx, .txt, .xls/.xlsx `[ASSUMPTION: size cap not specified — recommend 50MB/file per existing prototype's stated limit, confirm before build]`), each with independent progress, type/size/integrity validation, and secure storage.

**Consequences (testable):**
- An invalid file type/size is rejected per-file with a specific reason, without blocking the other files in the same batch.
- Each file's upload progress is independently visible and does not block interaction with other files' rows.
- Uploaded files are access-controlled the same way as taxonomy master data (FR-8's `masterdata.manage`-style policy gate) — scoped to course-owner (and co-tutors, if any) rather than left as an unspecified "secure storage" claim — and are scanned for malware and file-type mismatches (a free, self-hosted scanner — e.g. ClamAV — per cost review; no paid scanning service) before being handed to FR-12's parsing step.

#### FR-12: Parsing/OCR pre-step ahead of structure extraction

Before the AI Task `extractStructure()` runs, the system runs a dedicated document-parsing pass (with OCR for scanned/image-based pages, via a free self-hosted parser — e.g. Docling — per cost review, not a paid-per-page SaaS parser) to produce clean structured text/markdown; `extractStructure()` is not invoked directly against raw scanned-image bytes.

**Consequences (testable):**
- A scanned (image-only) PDF produces a non-empty parsed-text intermediate before extraction begins.
- Parsing failure on one file surfaces as that file's per-file failure state (FR-13) rather than a silent empty extraction.
- Parsed output below a minimum confidence-score threshold routes to that file's failed/retry state (FR-13) rather than passing through to `extractStructure()` — "non-empty" alone does not satisfy this FR; a garbled low-confidence OCR result is treated as a parsing failure, not a success. `[ASSUMPTION: exact confidence threshold not specified — confirm before build]`.

#### FR-13: AI-driven structure extraction with per-file status

For each successfully parsed file, the gateway's `extractStructure()` AI Task proposes a nested Chapter → Topic → Subtopic → Content structure. Per-file status (queued/parsing/extracting/done/failed) is visible; results from files that finish first surface immediately rather than waiting on the whole batch; failed files are independently retryable.

**Consequences (testable):**
- With 3 files uploaded where 1 fails extraction, the other 2 files' extracted structure is available and usable while the failed file shows a retry action.
- Retrying a failed file does not re-run extraction on the files that already succeeded.

---

### 4.4 Tutor Validation & Editing

**Description:** The tutor has full editorial control over AI-extracted structure before it can be reviewed or published — the AI drafts, the tutor approves. Realizes UJ-1, UJ-4.

**Functional Requirements:**

#### FR-14: Add, modify, delete, and reorder any node

Tutor can add, edit the text/structure of, delete, and reorder any Chapter, Topic, Subtopic, or Content Block, whether AI-extracted or tutor-added.

**Consequences (testable):**
- Deleting a Chapter removes its descendant Topics/Subtopics/Content Blocks.
- Reordering persists across a session reload.

#### FR-15: Explicit per-node confirmation

Each node (Chapter/Topic/Subtopic) carries an explicit tutor-confirmation state, separate from its content having been edited.

**Consequences (testable):**
- "Review as Student" (FR-23) is disabled while any node remains unconfirmed.
- A text-only edit to an already-confirmed node's Content Block leaves that node's confirmation intact — no re-confirm required.
- An edit that changes a node's structure (add/delete/reorder a child Chapter/Topic/Subtopic) or that would trigger regeneration of that node's Drill-Down/Alternative-Explanation content (§4.10, FR-21) resets that node's confirmation, requiring re-confirmation before Review as Student or Publish can proceed.

---

### 4.5 Subject-Aware Authoring & Rendering

**Description:** The editor and the student-facing view render content identically across all supported subjects and scripts — what the tutor edits is exactly what the student sees. Realizes UJ-1.

**Functional Requirements:**

#### FR-16: WYSIWYG parity across subjects and scripts

Both the tutor's editor and the student's view correctly author and display: mathematical/physics notation and equations; chemical formulas, reaction notation, and molecular/structural diagrams; labeled biology diagrams/figures; multilingual text including English and Hindi with correct fonts/scripts; plus images, tables, and general rich formatting. Math/physics and chemistry formula/reaction notation reuse the existing KaTeX-based rendering already used in `ReaderCanvas.tsx`, `DrilldownPanel.tsx`, `FlashcardsModal.tsx`, and `CoursePlayer.tsx`, extended with the `mhchem` extension (not currently installed). Chemistry structural/skeletal diagrams are out of KaTeX's reach (it's a text-notation renderer) and are handled the same way as biology diagrams/figures — tutor-uploaded or AI-extracted images embedded as Content Blocks, not rendered from notation.

**Consequences (testable):**
- A chemical equation or math expression entered in the editor renders identically (same KaTeX/mhchem notation, no fallback-to-plaintext) in student preview and live view.
- A chemistry structural diagram embedded as an image in the editor displays identically (same image, same placement) in student preview and live view, same as a biology figure.
- Hindi (Devanagari) text entered in the editor renders with correct script/font in student view on both desktop and mobile.
- A golden-file (visual-regression) diff test suite covers editor-vs-student-view rendering for math, chemistry, and Hindi-script content; a PR that introduces visual drift against the golden files fails.
- Rendered math/chemistry notation carries screen-reader alt-text generated by the gateway's `describeNotation()` AI Task (§4.1, FR-27) — not left as an unbacked accessibility claim with no generation mechanism. Hindi (Devanagari) content is tagged with the correct language attribute (`lang="hi"`) at the content-block level, distinct from the alt-text requirement, since Devanagari is navigable text, not a rendering needing a fallback.

**Feature-specific NFRs:**
- v1 language scope: English and Hindi, confirmed — no other language is committed for launch; additional languages are a v2 "if demand emerges" item (§6.2).

**Notes:**
- `[NOTE FOR PM]` The golden-file/visual-regression suite above is new CI/testing infrastructure — the frontend architecture spine's existing test convention (`vitest` + `@testing-library/react`) is DOM-assertion-only and cannot produce or diff pixel-level screenshots. This needs a distinct tool (e.g. Playwright + pixel-diff, or a hosted visual-regression service) with its own CI runner and baseline-image workflow, to be explicitly scoped at the architecture pass rather than assumed to fall out of the existing test setup.

---

### 4.6 Adaptive Learning — Five-Level Drill-Down

**Description:** Every Topic and Subtopic exposes 5 progressive depth levels of the *same* explanation; a student expands one level at a time. Reuses the existing `DrilldownPanel.tsx` UI, wiring it to AI-generated (and tutor-editable) content instead of static mock data. Realizes UJ-2. This literal reuse applies to FR-17 only — `DrilldownPanel.tsx` today implements the level-gated reveal with mock data, nothing more. The UI surfaces for §4.7–§4.9 (Ways secondary menu, exercises, keyword popovers) are not confirmed to already exist in that component; the UX pass should treat them as net-new surfaces that may live alongside `DrilldownPanel.tsx`, not as "already built, just wire data."

**Functional Requirements:**

#### FR-17: Five progressive depth levels, expanded one at a time

Every Topic/Subtopic has 5 Drill-Down Levels (Level 1 = simplest; Levels 2–5 progressively more detailed/rigorous), generated via the gateway's `explainTopic(level)` AI Task, tutor-editable/overridable, and revealed one level at a time via an "explain more" action.

**Consequences (testable):**
- A student never sees Level 3 content before having expanded Level 2 for that node.
- A tutor-authored override for a given level is served instead of the AI-generated version for that level, for that node, going forward.

---

### 4.7 Adaptive Learning — Five Alternative Explanations

**Description:** A separate mode from Drill-Down: 5 different explanations of the *same* Topic/Subtopic, each with its own worked example, freely cycled by the student. Realizes UJ-2.

**Functional Requirements:**

#### FR-18: Five alternative explanations with independent examples

Every Topic/Subtopic has 5 "Ways" (alternative explanations), each generated via the gateway's `rewriteExplanation(way)` AI Task with its own distinct worked example, tutor-editable/overridable, freely cyclable in any order by the student (not gated like Drill-Down levels).

**Consequences (testable):**
- Each of the 5 Ways includes both an explanation and an example; neither is empty for a Way that has been generated.
- Cycling from Way 3 to Way 1 directly (skipping Way 2) is possible — no forced order.

**Notes:**
- UX placement (decided in review): "Ways" is a secondary-menu entry point relative to Drill-Down's primary "explain more" action, not a peer button — but the Level 1 view must carry a visible nudge toward it (e.g. "not clicking? try a different explanation") rather than relying on a student to find an unprompted menu. Feeds directly into the UX pass (`bmad-ux`).

---

### 4.8 Optional Exercises

**Description:** Each Topic/Subtopic may carry optional practice exercise(s), tutor-decided (AI can propose), performed inline by the student. Realizes UJ-2, UJ-4.

**Functional Requirements:**

#### FR-19: Optional per-node exercises with inline completion

Tutor can optionally attach one or more exercises to a Topic/Subtopic (self-authored or AI-proposed via `generateExercise()`); students perform them inline, with subject-appropriate answer types (numeric/math, multiple choice, short text) and immediate feedback/worked solution on completion.

**Consequences (testable):**
- A Topic/Subtopic with no attached exercise shows no practice affordance to the student (no broken/empty state).
- Submitting an exercise answer immediately shows feedback and/or the worked solution without a page reload.

**Out of Scope:** Auto-grading beyond shown-solution/immediate-feedback is undecided — see §8 Open Question.

---

### 4.9 Click-Any-Keyword Explanation

**Description:** Any keyword in content is clickable for an on-the-spot, context-aware definition. Realizes UJ-2. This is the real implementation of `ReaderCanvas.tsx`'s existing but fake "Ask AI" affordance (`handleAskLevelLLM` — hardcoded response, no network call, per `addendum.md`'s prior-art notes): FR-20 replaces that simulated behavior with real AI Service Layer calls through `defineKeyword()`, rather than leaving it as a separate, dead, or duplicate feature.

**Functional Requirements:**

#### FR-20: Inline keyword definition popover

Any keyword in course content can be clicked/tapped to show an inline definition popover, generated via the gateway's `defineKeyword()` AI Task, context-aware to the course's subject and language; a tutor-authored definition for that keyword (in that course context) takes priority over the AI-generated one.

**Consequences (testable):**
- Clicking the same keyword in a Chemistry course and a Biology course can surface different, subject-appropriate definitions.
- A tutor-authored override for a keyword is served instead of the AI-generated definition for that exact keyword/course context.

**Feature-specific NFRs:**
- `defineKeyword()` is routed to the cheapest/fastest AI Task tier by default, given its high expected call volume (§4.1, FR-2/FR-4).

---

### 4.10 Generation & Caching Strategy

**Description:** Locks the timing decision for AI-generated adaptive content: pre-generated at publish, not on-demand per view.

**Functional Requirements:**

#### FR-21: Pre-generate and cache at publish

Drill-Down Levels (FR-17) and Alternative Explanations (FR-18) are generated for every confirmed node when a course is published (or re-published after a post-publish edit), cached, and served from cache to students rather than generated per view.

**Consequences (testable):**
- Opening a Drill-Down level or a Way as a student returns cached content with no visible AI-generation latency.
- Editing a node's confirmed content and re-publishing regenerates that node's cached Drill-Down/Way content; unedited nodes' caches are left untouched.
- Publishing is asynchronous: pressing Publish moves the course into a transient `Publishing` sub-state while a background job generates Drill-Down/Way content for every confirmed node; the course flips to `Published` only once that batch completes.
- A single node's generation failure does not block the rest of the course from publishing; that node serves on-demand generation as a fallback until its batch entry is retried or regenerated — students never see an empty node.

**Feature-specific NFRs:**
- Keyword definitions (FR-20) are generated on-demand, not pre-generated at publish, given the open-ended nature of "any keyword" — caching policy for repeat lookups is an open question (§8).

**Notes:**
- `[NOTE FOR PM]` The `Publishing` sub-state and background batch generation above require durable job/task state and a worker execution model that neither existing architecture doc establishes (the backend spine's Deferred section explicitly punted the AI pipeline, and the current deployment envelope has no worker/queue service). This is real new infrastructure, not an implementation detail — the architecture pass must explicitly decide the execution model (in-process background job vs. a durable job library vs. an external queue) before this FR can be built.

---

### 4.11 Draft → Review → Publish Lifecycle

**Description:** Governs what a tutor can do to a course at each Lifecycle State. Realizes UJ-4.

**Functional Requirements:**

#### FR-22: Save as Draft at any point

Tutor can leave and resume a course in `Draft` state at any point in the wizard or content editing (see also FR-10).

**Consequences (testable):**
- A course left mid-edit and reopened later resumes with all prior input intact and status still `Draft`.

#### FR-23: Review as Student mode

Tutor can preview the full course exactly as a student would see it — including Drill-Down (FR-17), Alternative Explanations (FR-18), Exercises (FR-19), and Keyword lookups (FR-20) — once all nodes are confirmed (FR-15). Entering this mode transitions the course to `In Review`.

**Consequences (testable):**
- Every interactive adaptive-learning affordance available to a real student (drill-down expand, way-cycling, exercise submission, keyword click) is exercisable in Review as Student mode.

#### FR-24: Required review confirmation gates Publish

Tutor must explicitly **Confirm Review** (transitioning the course to `Review Confirmed`) before **Publish** becomes available; Publish is disabled at every earlier Lifecycle State.

**Consequences (testable):**
- Attempting to publish a course still in `Draft` or `In Review` (not yet confirmed) is blocked.
- A course in `Review Confirmed` can be published, which begins the asynchronous generation batch described in FR-21 and transitions the course to `Published` once that batch completes.

#### FR-25: Post-publish editing with versioning

A tutor can return a `Published` course to `Draft` to make fixes, with prior published state retained as a version.

**Consequences (testable):**
- Editing a `Published` course does not alter what students currently see until the edited version is itself published.
- A prior published version remains retrievable after a new version is published. `[ASSUMPTION: no stated bound on how many prior versions are retained — recommend retain all; confirm before build]`.
- Whether an edit re-triggers Review Confirmation follows FR-15's small/not-small rule: a text-only edit to an already-confirmed node can be re-published without a fresh Confirm Review; a structural or regeneration-triggering edit reverts the course to `In Review` and requires a fresh Confirm Review before re-publishing.
- Re-publishing a previously `Published` course is gated by `Review Confirmed` exactly like first-time publish (FR-24) — there is no separate republish path that bypasses it.

**Notes:**
- `[NOTE FOR PM]` "Prior published state retained as a version" is satisfiable in two very different ways with an order-of-magnitude storage difference: a deep copy of the entire confirmed content tree plus its cached Drill-Down/Way content (FR-21) per version, or a lighter diff/audit-log approach. Neither this PRD nor either architecture spine picks one — real design work to scope explicitly at the architecture pass, not discover mid-build.

---

### 4.12 Admin — Tag Management

**Description:** Admin-only CRUD over the Tag master list consumed by §4.2 FR-7.

**Functional Requirements:**

#### FR-26: Tag CRUD with deactivation and duplicate prevention

Admin can add, rename, deactivate, and search Tags; duplicate tag names are prevented; deactivating a tag hides it from new selection (FR-7) but does not remove it from courses it's already attached to. Unlike FR-8's Taxonomy (which reuses the existing `MasterDataManager` scaffold), Tag management is net-new work: `Course.tags` today is a plain string array with no master-data backing, and `MasterDataManager` is a taxonomy-specific system, not a generic master-data framework — FR-26 is not a plug-in to that existing scaffold.

**Consequences (testable):**
- Attempting to create a tag with a name matching an existing (active or deactivated) tag, case-insensitively, is rejected.
- Deactivating a tag already attached to a published course leaves that course's tag list unchanged.

---

### 4.13 Admin — AI Configuration & Usage

**Description:** The control surface that makes the pluggable-backbone principle (§4.1) an operational reality — where the "config, not code" swap actually happens. Realizes UJ-3.

**Functional Requirements:**

#### FR-27: Per-task provider/model selection and fallback configuration

Admin can view and change the active provider/model for each AI Task (`extractStructure`, `explainTopic`, `rewriteExplanation`, `generateExercise`, `defineKeyword`, `describeNotation`, embeddings) independently, and configure a fallback provider/model per task.

**Consequences (testable):**
- Changing `explainTopic`'s model does not alter `defineKeyword`'s configured model.
- A configured fallback is exercised automatically per FR-3 without further admin action at request time.

#### FR-28: Usage and cost visibility per task

Admin can view token usage and computed cost, broken down by AI Task and by date range, sourced from FR-4's tracking.

**Consequences (testable):**
- Usage/cost for a given AI Task is visible separately from every other task's usage/cost.

#### FR-29: Budget threshold enforcement per task

Admin can set a cost threshold (per AI Task and/or platform-wide) against FR-4's usage tracking; the gateway surfaces a warning when usage approaches it and blocks routing new requests to a model/provider combination that would exceed it, rather than only reporting spend after the fact.

**Consequences (testable):**
- Usage crossing a configured warning percentage (e.g. 80%) of a task's threshold surfaces a visible alert to Admin before the hard limit is hit.
- A request that would exceed a configured hard threshold for its AI Task is blocked (or routed to a configured cheaper fallback, per FR-3) rather than silently processed and billed.
- Changing a threshold takes effect for the next request — no redeploy, consistent with FR-2.

**Notes:**
- `[NOTE FOR PM]` Enforcing a hard threshold on a high-volume task (`defineKeyword`, per §4.9's feature NFR) means reading current spend before every call — many concurrent `defineKeyword` requests checking/incrementing the same per-task counter is a real concurrency design point. The architecture pass should name the mechanism explicitly (e.g. an atomic DB counter, or a cached running total with periodic reconciliation) rather than leave "blocks routing before it's exceeded" implying a perfectly-consistent instant check.

---

### 4.14 Cross-Cutting NFRs

- **Cost control:** Free/cheap-tier models (including local models, FR-2) by default in dev; per-task cost tracking (FR-4) live from day one so cost-per-topic (SM-5) is comparable across the free→paid transition; high-volume tasks (`defineKeyword`) default-routed to the cheapest viable tier (§4.9); budget thresholds (FR-29) are an enforced guardrail, not just a dashboard — cost is a requirement to stay within, not merely a metric to watch.
- **Portability:** No vendor lock-in — a provider/model swap (FR-2) is a configuration change, never a code change. **Revised in cost review:** self-hosted, zero-markup OSS gateway (e.g. Portkey's open-source gateway) from day one, not a managed-then-self-hosted phasing — the original two-phase plan's "own the ops burden at launch, in exchange for data residency" trade-off is now paid up front instead, since self-hosting is genuinely free and the ops footprint is small (a lightweight proxy, not a heavy platform). This also removes the original plan's later re-authoring cost (FR-3's fallback chains and FR-29's budget config no longer need porting from one gateway's schema to another's, since there's only ever one gateway — see `addendum.md`).
- **Performance:** Large-file processing (FR-11–FR-13) is asynchronous and non-blocking per file; student-facing Drill-Down/Way content is pre-generated and cached (FR-21) for near-instant response; Keyword definitions (FR-20) target low-latency response given on-demand generation — `[ASSUMPTION: no numeric target specified — recommend defineKeyword p95 < 1.5s; confirm before build]`.
- **Reliability:** Per-file failure (FR-13) never loses other files' progress; AI-layer fallback (FR-3) covers provider outage/rate-limiting; wizard state auto-persists (FR-10, FR-22) so no in-progress work is lost to a closed tab or crash.
- **Security & Privacy:** Uploaded files are stored with access control and scanned for malware/file-type mismatches before processing (FR-11) via a free, self-hosted scanner (e.g. ClamAV) — no paid scanning service required; free-tier dev usage involving real-ish student content is restricted to providers that do not train on input by default (§4.1 feature-specific NFR); self-hosting the gateway from day one (FR-2) means student data never transits a third-party managed relay at all, not just from launch onward.
- **Accessibility & i18n:** Multilingual scripts (English, Hindi — FR-16) and mathematical/scientific notation render correctly across devices; standard accessibility practices apply to all new interactive surfaces (wizard, drill-down, exercises, keyword popovers). `[ASSUMPTION: no specific WCAG conformance level was named in the source draft — recommend WCAG 2.1 AA consistent with typical launch-grade bar; confirm before build]`.

## 5. Non-Goals (Explicit)

- This PRD does not modify or rebuild taxonomy admin management — it consumes the existing MasterDataManager system as-is (§4.2, FR-8).
- This PRD does not patch or extend Dashboard PRD's FR-18's 4-step shell — it fully supersedes that flow (§0).
- This PRD does not replace the existing `DrilldownPanel.tsx` component — it wires real AI-generated content behind it (§4.6, FR-17).
- No auto-generated full assessments/quizzes beyond the per-topic optional exercises in §4.8.
- No student enrollment, consumption-analytics, or progress-tracking dashboards.
- No monetization or pricing mechanics.
- No collaborative multi-tutor editing of the same course.
- No automatic personalization that adapts depth or style to a student over time without their action — the student always chooses which Drill-Down Level or Way to view; the system does not infer or auto-select on their behalf.
- No bulk/API course import and no non-tutor course authoring (§2.2).

## 6. MVP Scope

The four adaptive-learning mechanisms (§4.6–§4.9) ship together rather than being phased in, because they're coupled, not merely bundled: §4.7's decided UX placement makes "Ways" a secondary action relative to Drill-Down's primary "explain more" (FR-18's Notes), so Alternative Explanations cannot exist as a standalone surface without Drill-Down already being the primary action it's secondary *to*. Exercises and Keyword Definitions are lower-coupling but small enough in scope (FR-19, FR-20) that splitting them into a fast-follow wasn't judged worth the phasing overhead for a launch-grade cut.

### 6.1 In Scope
- Full AI Service Layer (§4.1): gateway abstraction, config-only swap, per-task model + fallback, usage/cost tracking, centralized prompt/config.
- Full wizard: Title, Tags, Taxonomy (reusing MasterDataManager), Thumbnails, multi-file upload, parsing/OCR pre-step, AI structure extraction, full tutor editing/confirmation.
- Subject-aware authoring/rendering (§4.5) for math/physics, chemistry, biology, English, and Hindi.
- All four adaptive-learning mechanisms: 5-level drill-down, 5-way alternative explanations, optional exercises (shown-solution, not auto-graded — see §8), click-any-keyword.
- Pre-generation-at-publish + caching (§4.10).
- Full Draft → In Review → Review Confirmed → Published lifecycle, including Review as Student and post-publish return-to-draft with versioning.
- Admin tag management (§4.12) and AI configuration/usage/budget enforcement (§4.13, incl. FR-29).

### 6.2 Out of Scope for MVP
- Auto-grading of exercises beyond immediate feedback/shown-solution — deferred pending §8 resolution.
- Languages beyond English and Hindi — deferred to v2 if demand emerges (§8).
- Deep OCR accuracy tuning for heavily degraded scans — a baseline parsing/OCR pass (FR-12) ships in MVP; per-document-quality tuning is deferred. `[NOTE FOR PM: if a meaningful share of tutor-uploaded material is low-quality scans, revisit this cut before launch.]`
- Institution-level bulk import, API-based course creation (§2.2 Non-Users).

## 7. Success Metrics

**Primary**
- **SM-1**: % of topic/subtopic views where a student engages Drill-Down or Alternative-Explanation mode. Validates FR-17, FR-18.
- **SM-2**: Student self-reported "I understood this" rate per topic (in-context prompt after engaging an adaptive-learning mode). Validates FR-17, FR-18, FR-19, FR-20.

**Secondary**
- **SM-3**: % of AI-extracted Chapters/Topics/Subtopics confirmed with no or only minor tutor edits. Validates FR-13, FR-14, FR-15.
- **SM-4**: Draft → Published conversion rate. Validates FR-22–FR-25.

**Cost / Operational**
- **SM-5**: Cost per generated topic (drill-down + alt-explanation generation), tracked separately for dev free-tier vs. production paid-tier, and before/after any provider swap; stays within the budget threshold configured per FR-29. Validates FR-2, FR-4, FR-21, FR-29.

**Counter-metrics (do not optimize)**
- **SM-C1**: SM-3 (extraction acceptance rate) must not be chased by generating vaguer, more generically "acceptable" structures — a technically unedited but low-quality structure is a failure, not a win. Counterbalances SM-3.
- **SM-C2**: SM-1 (adaptive-mode engagement) must not be chased by deliberately weakening Level 1 / Way 1 explanations to manufacture deeper engagement — Level 1 and Way 1 must independently satisfy SM-2 on their own. Counterbalances SM-1.
- **SM-C3**: SM-5 (cost per generated topic) must not be hit by silently routing to weaker models in a way that erodes SM-2 ("I understood this") — a budget threshold (FR-29) that's satisfied by degrading quality below what SM-2 requires is a failure, not a win. Counterbalances SM-5.

## 8. Open Questions

1. Do exercises need auto-grading, or is shown-solution/immediate-feedback (current MVP scope, §6.2) sufficient for v1?
2. Should keyword definitions (FR-20) be cached per course to cut repeat generation cost, given they're generated on-demand rather than pre-generated (§4.10)?
3. Final provider/model selection: dev-phase free-tier provider(s) and launch-phase best-fit model per AI Task, verified against then-current pricing/limits at build time (directionally: Groq-class provider for privacy-safe dev free tier; frontier reasoning model for Drill-Down; cheapest viable tier for `defineKeyword` — see `addendum.md` for the August 2026 research snapshot behind this, which will be stale by build time).
4. What specific accessibility conformance level applies (Cross-Cutting NFRs, §4.14) — WCAG 2.1 AA assumed, not confirmed?

## 9. Assumptions Index

- §4.1 FR-2 — Self-hosted, zero-markup OSS gateway (e.g. Portkey's open-source gateway) from day one, no managed-phase migration; exact product deferred to build time. Decided in cost review, 2026-08-11.
- §4.3 FR-11 — Malware/file-type scanner not named beyond "a free, self-hosted scanner (e.g. ClamAV)"; exact tool deferred to build time. Decided in cost review, 2026-08-11.
- §4.3 FR-12 — Document parser not named beyond "a free self-hosted parser (e.g. Docling)"; exact tool deferred to build time, with a known accuracy trade-off on heavily degraded scans accepted vs. a paid alternative. Decided in cost review, 2026-08-11.
- §4.1 (feature NFR) — Specific free-tier provider list (privacy-safe vs. synthetic-only) to be verified at build time against then-current terms.
- §4.2 FR-6 — Course Title max length not specified; recommend 120 characters.
- §4.2 FR-9 — Thumbnail file size cap not specified; recommend 5MB/file.
- §4.2 FR-9 — Exact fixed aspect ratio for thumbnail cropping not specified; recommend 16:9, confirm before build.
- §4.3 FR-11 — Upload file size cap not specified; recommend 50MB/file (matches existing prototype's stated limit).
- §4.3 FR-12 — Exact OCR/parsing confidence threshold for routing to failed/retry not specified; confirm before build.
- §4.10 (feature NFR) — Keyword-definition caching policy left open (§8.2).
- §4.11 FR-25 — No stated bound on prior-version retention count; recommend retain all, confirm before build.
- §4.14 Performance — No numeric latency target specified; recommend `defineKeyword` p95 < 1.5s, confirm before build.
- §4.14 (Accessibility) — WCAG 2.1 AA assumed as the conformance target; not confirmed by the user.
- §2.3 Key User Journeys — All four journeys are structured from the source draft's stated flows, not independently narrated live by the user this session; confirm narrative fidelity before UX work begins.
- §2.3 UJ-1 — OCR/parsing status is assumed to surface to the tutor only as a plain status label, not technical detail.
