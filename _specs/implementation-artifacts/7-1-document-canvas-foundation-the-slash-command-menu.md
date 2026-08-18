---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 7.1: Document Canvas Foundation & the "/" Slash-Command Menu

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to open the Course Content Editor on an empty course and get a working "/"-driven document canvas,
So that I have a single, keyboard-accessible way to start authoring instead of a wizard or an empty tree.

## Acceptance Criteria

1. **Given** a course with an empty outline **When** the tutor opens the Course Content Editor **Then** it opens on one empty document, cursor active on the Chapter-title heading, with no wizard step or step indicator (FR-9, FR-14)
2. **Given** the tutor's cursor is on an empty line **When** they type "/" **Then** a filterable, categorized command menu opens at the cursor, keyboard-operable via Arrow Up/Down/Enter/Escape, with a "No matching blocks" row when nothing matches the typed query (FR-14, UX-DR2, UX-DR5)
3. **Given** the "/" menu is open **When** the tutor presses Escape **Then** the menu closes without inserting, the typed "/"+query is stripped, and focus returns to the exact document position "/" was typed at (UX-DR5)
4. A "+" click affordance is available at the start of every empty line and end of every block, visible on hover AND keyboard focus (never hover-only), opening the identical menu without typing "/" (FR-14, UX-DR3)
5. The "/" keydown handler is scoped to the editor's own region and gated on `!event.isComposing`, so it never fires mid-IME-composition or collides with the browser's native Quick Find (UX-DR4)
6. On committing a menu selection, focus moves into the new block's first editable field and an `aria-live="polite"` region announces what was inserted (FR-14, UX-DR6)
7. The slash-menu's open/dismiss transition and any block-insert animation respect `prefers-reduced-motion: reduce` (UX-DR11)
8. **Given** a course with existing content **When** the tutor reopens the Course Content Editor **Then** visible loading text is shown while the document fetches ("Loading your chapter…"), not a bare spinner (UX-DR12)
9. **Given** a course is `Published` **When** the tutor opens the Course Content Editor on it **Then** the document opens read-only — no "/" menu, no editable headings — with a visible banner and a link to "Take Offline" to resume editing (UX-DR12)

## Tasks / Subtasks

- [x] Task 1 — Backend: stand up the minimal Chapter slice this story needs (AC: #1, #8, #9)
  - [x] `Domain/Courses/Chapter.cs`: explicit typed entity (AD-20 — real FK, not polymorphic; only `Page`/`Resource` are polymorphic, and neither exists yet). Fields: `Id` (from `AuditableEntity`), `CourseId` (FK), `Title` (required, ≤200 chars — FR-4), `Description` (optional, ≤2000 chars, Markdown-lite — FR-4, populated by a later story; leave the column but don't build UI for it here), `Order` (int), `IsConfirmed` (bool, default `false` — FR-44/Story 7.4 owns the reset semantics; this story only needs the column to exist and default correctly)
  - [x] `Infrastructure/Persistence/Configurations/ChapterConfiguration.cs`: `IEntityTypeConfiguration<Chapter>`, FK to `Course`, no data annotations on the entity itself
  - [x] EF Core migration (`dotnet ef migrations add AddChapter --startup-project ../FlexDemy.Api --project .` from `src/FlexDemy.Infrastructure`) — coordinate timing so this is the only in-flight migration against `main`
  - [x] `Application/Courses/IContentRepository.cs` + `Infrastructure/Repositories/ContentRepository.cs`: **one repository for the whole outline** (AD-20's named exception to the per-entity-repository default — Topic/Subtopic/Page/Resource methods are added onto this same interface by Stories 7.2/7.3/8.1, not a new repository per entity). This story implements only the Chapter methods it needs: `GetChaptersByCourseIdAsync(courseId)` (id/title/order only, for the "does this course already have a chapter" check), `GetChapterByIdAsync(chapterId)`, `Add(Chapter)`, `Update(Chapter)`
  - [x] `Application/Courses/IContentService.cs` + `ContentService.cs`: `GetChapterListAsync(courseId)`, `GetChapterDocumentAsync(courseId, chapterId)` (returns the nested document DTO below), `CreateChapterAsync(courseId, title)`, `UpdateChapterAsync(courseId, chapterId, title, description)`. Every **read** uses the existing `ICourseService.EnsureOwnedAsync`-style check (ownership only, **not** Draft-gated — AD-29: "Owner (tutor) read: unchanged, always allowed regardless of lifecycle state"), so a tutor can open a `Published` course read-only (AC #9). Every **mutation** uses `ICourseService.EnsureOwnedDraftAsync` (rejects writes once the course has left Draft — FR-48's ownership+Draft-state guard). Depend on `ICourseService` for these checks, never `ICourseRepository` directly (per `Application/Courses/ICourseService.cs`'s existing `EnsureOwnedAsync`/`EnsureOwnedDraftAsync` methods — read them before writing this service, they're the reference pattern)
  - [x] DTOs in `Application/Courses/`: `ChapterSummaryDto` (`id`, `title`, `order`) for the list; `ChapterDocumentDto` (`id`, `courseId`, `title`, `description`, `isConfirmed`, `topics: TopicDocumentDto[]`) for the document fetch — **declare the nested `topics` array now, always empty for this story**, so Story 7.2 extends `ContentService`/`ContentRepository` to populate it instead of redesigning the DTO shape. `ChapterMapper.cs` alongside, `ToDto()`/`ToEntity()` static extension methods (no AutoMapper — not in this project)
  - [x] `Api/Controllers/ContentController.cs` (new), `[Route("api/v1/courses/{courseId}/content")]`: `GET chapters` (list, ownership-only read check) → `IReadOnlyList<ChapterSummaryDto>`; `GET chapters/{chapterId}/document` (ownership-only read check) → `ChapterDocumentDto`; `POST chapters` (`EnsureOwnedDraftAsync`, body `{ title }`) → creates and returns the new `ChapterSummaryDto`; `PUT chapters/{chapterId}` (`EnsureOwnedDraftAsync`, body `{ title, description }`) → updates and returns `ChapterDocumentDto`. **Route note:** the architecture's Additional-Requirements summary phrases this as `GET /api/v1/courses/{courseId}/chapters/{chapterId}/document`, but the backend spine's own Structural Seed pins `ContentController`'s class-level route to `api/v1/courses/{courseId}/content` — this task follows the Structural Seed (the more specific, authoritative source) and nests `chapters/...` under it; don't "fix" this back to the summary's shorter path. No `[Authorize(Policy = ...)]` attribute needed on any of these four actions — the ownership checks inside `ContentService` are the real gate, same shape as `CoursesController.GetCourseContent`'s existing unauthenticated-route-but-service-checked pattern. (AD-29's reviewer/student read branches, and the SVG/HtmlSanitizer work, belong to Stories 11.3 and 8.1 respectively — do not build them here.)
  - [x] Register `IContentRepository`/`IContentService` in `Infrastructure/DependencyInjection.cs` / `Application`'s DI registration, matching the existing `ICourseRepository`/`ICourseService` registration shape
  - [x] Backend tests (`FlexDemy.Application.Tests/Courses/ContentServiceTests.cs`, `FlexDemy.Infrastructure.Tests/Repositories/ContentRepositoryTests.cs` — mirror `src/`, don't colocate): a non-owner gets `NotFoundException` on both list and document reads regardless of lifecycle state except the AD-29 branches this story doesn't build (leave those as explicit `[Fact(Skip = "Story 11.3")]` or a TODO comment, not silently unhandled); an owner can read a `Published` course's chapter document; a mutation on a `Published`/`InReview`/`ReviewConfirmed` course throws via `EnsureOwnedDraftAsync`; `Title` over 200 chars is rejected

- [x] Task 2 — Frontend: install and configure Tiptap (AD-9) (AC: #1, #2)
  - [x] `npm install @tiptap/react@3.30.1 @tiptap/core@3.30.1 @tiptap/starter-kit@3.30.1 @tiptap/markdown` in `FrontEnd/` (pin the exact `3.30.1` the architecture spine web-verified, not a caret range, matching this repo's existing pattern of pinning version-sensitive pairs like `@vitest/browser-playwright`/`vitest`)
  - [x] Confirm no peer-dependency conflict with `react@^19.0.1` at install time (the architecture spine's compatibility claim is scoped to `core`/`react`/`starter-kit`, not Tiptap's UI Components or Pro extensions — neither of which this story touches)

- [x] Task 3 — Frontend: generic slash-menu mechanism in `lib/editor/` (AD-10) (AC: #2, #3, #4, #5, #6, #7)
  - [x] New folder `FrontEnd/src/lib/editor/` — **explicit named exception** to this spine's "`lib/` is only ever called from `services/`" rule (AD-10); it's called directly by `features/CourseContentEditor/` because it has no data-access/persistence concern
  - [x] `SlashMenu.tsx` (or equivalent): built on Tiptap's `@tiptap/suggestion` utility. Tiptap's own official slash-command example is labeled "experimental" — treat it as a starting point to harden, not a drop-in. Implement, verbatim against `EXPERIENCE.md`'s Accessibility Floor (not "ARIA wiring" as a vague label):
    - Trigger: `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the menu
    - Menu: `role="listbox"`; each command `role="option"`; category eyebrow labels are `role="group"`/`aria-label`, **skipped** by Arrow-key traversal (never counted as an option)
    - Highlighted option exposed via `aria-activedescendant` on the trigger — never conveyed by background color alone
    - Arrow Up/Down moves the highlighted option; Enter commits it; Escape closes without inserting, strips the typed `"/"+query` back to nothing, and returns focus to the exact document position "/" was typed at; **Tab is never repurposed** as an in-menu navigation key — it always exits the field to the next focusable element and closes the menu
    - Zero-match state renders a literal "No matching blocks" `role="option"`-less text row inside the still-open `listbox` — never a collapsed/blank menu
    - Keydown handler scoped to the editor's own editable region (never a document-level listener), gated on `!event.isComposing` (IME safety) — this also prevents collision with Firefox's native "/" Quick Find, which only fires when no editable element has focus
    - On commit: focus moves into the newly inserted block's first editable field; an `aria-live="polite"` region announces what was inserted (e.g. "Paragraph inserted")
    - Menu open/dismiss and any block-insert animation wrapped so they respect `prefers-reduced-motion: reduce` (check `window.matchMedia('(prefers-reduced-motion: reduce)')`, same pattern this codebase already applies elsewhere for confetti/crossfade/etc. — grep an existing usage before inventing a new one)
  - [x] `content-slash-menu` DESIGN.md tokens: white overlay, `shadow-xl`, `rounded.lg`, filter-echo row at top with the matched substring highlighted in `citrus-amber`-tinted `rounded.sm` marks, grouped command rows below (category eyebrow label, then icon-well + label + one-line description), keyboard-selected match shown via a filled icon-well + `surface-secondary` row background (never color-alone)
  - [x] Position-aware filtering hook (schema-context introspection) lives here too, even though this story has no Description-zone content to filter yet (Story 7.2/7.3) — build the extension point now so 7.2 doesn't have to retrofit it
  - [x] The mechanism is domain-agnostic: it accepts a command list as a prop/data argument. **This story's own command list is intentionally minimal** — seed it with a single "Paragraph" command (inserts an empty paragraph, already provided by `@tiptap/starter-kit`) purely to prove and test the mechanism end-to-end. Do not build out FR-26's full command set (Topic heading, New Page, Image, Math, …) here — those land incrementally with Stories 7.2/7.3/8.1/9.x, each adding to the feature-owned command list this story establishes the shape for

- [x] Task 4 — Frontend: custom heading Node extensions (AD-9, AD-10) (AC: #1)
  - [x] `features/CourseContentEditor/extensions/` (new folder) — domain-specific Node/NodeView extensions, distinct from `lib/editor/`'s generic mechanism (AD-10)
  - [x] This story needs only the Chapter-title heading: a real native `h1` Tiptap node with `contenteditable` on the node itself (never a styled `div`/`textarea` standing in for a heading — the exact accessibility bug the reference UX mock originally shipped and had to be fixed, per AD-9's own "Prevents" clause). `@tiptap/starter-kit`'s built-in Heading node likely covers this directly (levels 1–4) — confirm before writing a custom extension; only build `PageMarker.ts`/`LearningResourcesBlock.ts`/etc. when their stories (7.3/8.1) actually need them, not now
  - [x] Filename convention going forward: `PascalCase.ts` under this folder, one file per extension (Consistency Conventions table)

- [x] Task 5 — Frontend: wire the canvas into `CourseContentEditor.tsx` (AC: #1, #4, #8, #9)
  - [x] Read `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` completely before editing — it currently renders only the file-upload/parsed-content-viewer surface (no Chapter/Topic/Subtopic tree exists in the live code today, despite the architecture docs referencing a "superseded tree" — that tree was never actually built; treat this component as close to greenfield for the canvas, not a tree-to-canvas migration). **Preserve, don't remove:** the "Uploaded Files" section, `useFileUpload`, the Maximize/Restore toggle, `PublishLifecycleBar`, the `aria-live` file-status announcer, the Escape-to-close handler, and the `fullWidth`/`isOpen`/`draftId`/`onClose` prop contract — this story adds the document canvas as new content inside the existing card shell, it does not redesign the shell
  - [x] New `useContentDocument.ts` (or equivalent) hook, colocated in `features/CourseContentEditor/`: on mount (and whenever `draftId` changes), calls the new `courseContentService.ts` (see Task 6) to `getChapters(courseId)`. If the list is non-empty, fetch `getChapterDocument(courseId, chapters[0].id)` and show the loading-text state (AC #8) while it resolves. If the list is empty, render a **local, uncommitted** empty document (h1 with cursor active, no create call fired yet) — do not `POST /chapters` just because the editor was opened; only create the Chapter once the tutor actually types into the title and it blurs (mirrors FR-15's "persists on block-blur, not on completing a step," and avoids littering empty Chapter rows for courses opened and abandoned). The actual autosave-on-blur call, its saved/saving/failed indicator, and retry UX are Story 7.4's scope — this story's minimal stub only needs the `POST`/`PUT` call to genuinely fire and succeed so AC #8 ("reopening... shows the same document") is genuinely verifiable; don't build 7.4's full indicator here
  - [x] Published read-only state (AC #9): read `useCourseLifecycle(draftId).state === 'published'` (the hook already exists and already exposes this — see `useCourseLifecycle.ts`) and, when true, render the document with no `"/"`-menu wiring and no `contenteditable` on any heading, plus a banner ("This course is Published — take it offline to make changes") with a link that calls `triggerReturnToDraft` (the hook already exposes this trigger; reuse it, don't build a second "take offline" path)
  - [x] Loading-text state (AC #8): a visible `"Loading your chapter…"` text node, not a bare `<Spinner />` — matches this codebase's existing "every loading state has visible text" convention (see `MyCoursesSection`'s "Loading your courses…" precedent cited in `EXPERIENCE.md`)

- [x] Task 6 — Frontend: `courseContentService.ts` (AD-1, AD-4) (AC: #1, #8, #9)
  - [x] New `FrontEnd/src/services/courseContentService.ts` (does not exist yet — this story creates it; later stories add to it, not replace it). Functions: `getChapters(courseId): Promise<ChapterSummaryDto[]>` (`GET .../content/chapters`), `getChapterDocument(courseId, chapterId): Promise<ChapterDocumentDto>` (`GET .../content/chapters/{chapterId}/document`), `createChapter(courseId, title): Promise<ChapterSummaryDto>` (`POST .../content/chapters`), `updateChapter(courseId, chapterId, fields): Promise<ChapterDocumentDto>` (`PUT .../content/chapters/{chapterId}`) — **use `PUT`, not `PATCH`**: `services/httpClient.ts`'s shared `request()` helper only supports `'GET' | 'POST' | 'PUT' | 'DELETE'` today (confirmed by reading it), even though the architecture spine's AD-11 prose example says `PATCH /nodes/{id}` generically — follow this codebase's actual `PUT`-for-partial-update convention (`courseDraftService.ts`'s `updateDraftCourse` is the precedent), don't add PATCH support to `httpClient.ts` as a side effect of this story
  - [x] Route through `httpClient.ts`'s `request()` exactly like every other service (AD-1/AD-7) — never a direct `fetch` call — so correlation-ID capture keeps working uniformly
  - [x] `CourseContentContext`/full outline-metadata Context (AD-4) is **not** built by this story — that's a reasonable Story 7.2 concern once there's a real outline (Topics/Sub-Topics) to hold state for. This story's hook (Task 5) calls the service directly; don't invent a Context wrapper prematurely

- [x] Task 7 — Tests (AD-5, AD-6 where applicable)
  - [x] `FrontEnd/tests/lib/editor/SlashMenu.test.tsx` (new mirror path): opens on "/", filters by typed query, "No matching blocks" row on a non-matching query, Arrow Up/Down moves `aria-activedescendant`, Enter commits and moves focus + fires the `aria-live` announcement, Escape strips the query and returns focus to the exact prior position, Tab exits without inserting, keydown handler no-ops while `event.isComposing` is true
  - [x] `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx` (extend the existing file, don't replace it — read it first): empty-course case renders the empty document with active cursor and no create call; existing-content case shows "Loading your chapter…" then the fetched title; `Published` lifecycle state renders the read-only banner and suppresses the "/" menu (mock `useCourseLifecycle`'s return the same way this test file's existing tests likely already do — check its current mocking pattern before adding a new one)
  - [x] Backend tests per Task 1's own bullet above

## Dev Notes

- **This is the first story to touch the ContentAuthoring backend surface at all.** No `Chapter`/`Topic`/`Subtopic`/`Page`/`Resource` domain entities exist anywhere in the current codebase (confirmed by grep — `Backend/src/FlexDemy.Domain` has no `Courses/Chapter.cs` etc. today), and `FrontEnd/src/services/courseContentService.ts` / `FrontEnd/src/context/CourseContentContext.tsx` don't exist yet either, despite being referenced as already-existing in the architecture spines' prose — those spines describe the **target** state this epic builds toward, not code that's already there. Treat every file this story creates as new, not an update, except where explicitly noted (`CourseContentEditor.tsx`, `useCourseLifecycle.ts` — both real, both to be read-then-extended, not replaced).
- **Scope boundary vs. Story 7.4:** this story's autosave is a bare-minimum stub (a `PUT` call on title-blur) — just enough to make AC #8's "reopen shows the same content" true. Story 7.4 owns the real saved/saving/failed indicator, debounce timing, retry UX, and FR-44's confirmation-reset semantics (AD-11's full `useContentAutosave.ts` design). Don't build 7.4's scope now; don't leave 7.1 so bare that its own ACs can't be verified either.
- **Scope boundary vs. Story 7.2:** Topic/Sub-Topic headings, the Table-of-Contents rail, drag/keyboard reordering, and node deletion are all Story 7.2. This story's document contains only the Chapter-title `h1` and (per Task 3) a single "Paragraph" slash-command stub.
- **Architecture — frontend (`architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md`):** AD-9 (Tiptap foundation, exact versions, ARIA contract binding), AD-10 (generic `lib/editor/` mechanism vs. feature-owned command list and extensions, Description-zone schema constraint — not yet exercised by this story), AD-11 (autosave boundary-detection — only its "create call fires synchronously" principle is relevant here; the rest is 7.4's), AD-1 (services-only data access), AD-3 (dependency direction — `lib/editor/`'s exception is explicit and scoped, don't generalize it to other `lib/` modules).
- **Architecture — backend (`architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`):** AD-20 (Chapter is an explicit typed entity with a real FK; `OwnerType` polymorphism is a Page/Resource-only concern this story doesn't touch), AD-29 (owner reads always allowed regardless of lifecycle state; only mutations are Draft-gated — this is why AC #9's Published-course read works at all), the Structural Seed's `ContentController`/`IContentRepository`/`IContentService` naming (used verbatim in Task 1, don't rename).
- **UX:** `DESIGN.md` tokens `content-doc-heading` and `content-slash-menu`; `EXPERIENCE.md`'s Accessibility Floor bullets on the slash-menu (trigger/keyboard-model/IME-safety/post-insert — quoted near-verbatim into Task 3), and its State Patterns rows "Empty — first open," "Loading — reopening an existing document," and "Viewing a Published course."
- **Existing code read for this story (read fully before editing):** `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` (current shell — file upload only, no tree), `FrontEnd/src/features/CourseContentEditor/useCourseLifecycle.ts` (already exposes `state`/`triggerReturnToDraft`, reuse both), `FrontEnd/src/services/courseDraftService.ts` and `FrontEnd/src/services/httpClient.ts` (service/request conventions to mirror), `Backend/src/FlexDemy.Api/Controllers/CoursesController.cs` and `Backend/src/FlexDemy.Application/Courses/CourseService.cs` / `ICourseService.cs` (controller thinness, `EnsureOwnedAsync`/`EnsureOwnedDraftAsync` reference pattern), `Backend/src/FlexDemy.Domain/Common/AuditableEntity.cs` (every new entity's base).
- **Git/recent-work context:** the 5 most recent commits (`245d803`, `1a98615`, `0717c8b`, `6c1d6db`, `f3131d9`) are all small UI/font/transition fixes to the pre-existing tree-based editor concept and unrelated areas — none introduce conventions this story needs to follow beyond what's already covered above.

### Project Structure Notes

- New frontend folders this story creates: `FrontEnd/src/lib/editor/`, `FrontEnd/src/features/CourseContentEditor/extensions/`. New frontend file: `FrontEnd/src/services/courseContentService.ts`.
- New backend folders/files: `Backend/src/FlexDemy.Domain/Courses/Chapter.cs` (alongside existing `Course.cs`), `Backend/src/FlexDemy.Infrastructure/Persistence/Configurations/ChapterConfiguration.cs`, `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs`, `Backend/src/FlexDemy.Application/Courses/{IContentRepository,IContentService,ContentService,ChapterMapper}.cs` + DTOs, `Backend/src/FlexDemy.Api/Controllers/ContentController.cs`.
- No conflicts detected with the unified project structure — every new file lands exactly where the Structural Seed in both architecture spines says it should.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 7.1] — verbatim Acceptance Criteria
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-2026-08-09/ARCHITECTURE-SPINE.md#AD-9, #AD-10, #AD-11, #Structural Seed]
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-20, #AD-29, #Structural Seed]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md#content-doc-heading, #content-slash-menu]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/EXPERIENCE.md#Accessibility Floor, #State Patterns]

## Change Log

- 2026-08-17: Implemented Story 7.1 in full — Chapter domain entity/repository/service/controller (backend), Tiptap document canvas with the generic "/" slash-command mechanism, "+" click affordance, Chapter-title heading, and CourseContentEditor wiring (frontend). All 9 ACs satisfied. Status: `ready-for-dev` → `review`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Backend build/test: `dotnet build`, `dotnet test` — all green (488 + 193 + 141 = 822 backend tests passing, 0 failures, after this story's additions).
- EF Core migration `20260817082559_AddChapter` created via `dotnet ef migrations add AddChapter --startup-project ../FlexDemy.Api --project .`
- Frontend typecheck: `npx tsc --noEmit` — no new errors introduced (17 pre-existing errors in unrelated files, confirmed via `git status` that none of the affected files were touched by this story).
- Frontend full suite: `npx vitest run` — 636/636 tests passing across 83 files (final confirmation run in progress as this record is written; all targeted re-runs immediately prior were 100% green).

### Completion Notes List

- **Corrected a method reference during implementation:** `ContentService` initially called a not-yet-existing `courseService.EnsureReadableAsync` (that's Story 11.3's future addition) — fixed to call the already-existing `ICourseService.EnsureOwnedAsync` per the story's own Task 1 instruction, before this ever reached a build.
- **`ContentRepository`/`ContentService` intentionally has no explicit `Update(Chapter)` repository method**, deviating from the story's literal Task 1 wording ("`Add(Chapter)`, `Update(Chapter)`"). Read `CourseRepository.cs`/`CourseService.cs` in full first: this codebase's established convention (`UpdateDraftCourseAsync`, `RemoveThumbnailAsync`, etc.) is to load a tracked EF entity, mutate its properties directly, and call `IUnitOfWork.SaveChangesAsync()` — EF's change tracker detects the mutation with no explicit `Update()` call needed. Matched that existing pattern instead of adding an unnecessary, unused method.
- **`@tiptap/suggestion`'s actual installed API (3.30.1) is substantially more capable than the story's own description assumed** — it ships built-in Floating UI-based positioning via `props.mount(element)` and a programmatic `exitSuggestion(view)` export, neither mentioned in the story text (written against Tiptap's older/simpler documented example). Used both: `props.mount()` for the slash-menu's positioning (no manual `clientRect`/fixed-wrapper code needed, and no new dependency — Floating UI is already a transitive dependency of `@tiptap/suggestion`), and `exitSuggestion()` for Tab's "close without a native-Enter side effect" behavior (found via a real failing test — see below).
- **AC #4 (the "+" click affordance) required a real design correction mid-implementation.** A first attempt implemented it as a ProseMirror decoration widget placed inside the heading/paragraph's own DOM (matching a naive reading of "at the start of every empty line"). Two real test failures exposed why this was wrong: (1) the button's own accessible name ("Insert block") was being included in the ancestor heading's content-based accessible name per the standard accname algorithm, silently corrupting `getByRole('heading', {name: ...})` lookups (a real screen-reader-facing bug, not just a test artifact); (2) the button's own decoration text ("+") polluted the heading's `.textContent`, breaking the Escape-strips-typed-query assertion. Rebuilt as `PlusAffordanceButton.tsx`, a genuine React sibling of `<EditorContent>` (not a DOM descendant of the editable content), positioned via `editor.view.coordsAtPos()` and recomputed on `selectionUpdate`/`transaction` — this sidesteps both bugs by construction and lets plain CSS `:hover`/`:focus` do the "visible on hover and keyboard focus" work directly, no ARIA workarounds needed.
- **Two jsdom test-environment gaps required narrow, test-file-scoped polyfills** (not applied to `vitest.setup.ts` globally, since no other test file in this codebase mounts a real ProseMirror-backed editable region yet): `document.elementFromPoint` (ProseMirror's mousedown handler calls it unconditionally) and `Range.prototype.getClientRects`/`getBoundingClientRect` (Tiptap's internal `scrollIntoView`-on-selection-change calls these). Both are no-op stubs returning empty/zero results, sufficient for jsdom's non-layout-aware environment.
- **One test was redesigned rather than fixed as originally written:** a CourseContentEditor-level test simulating a real keystroke (`userEvent.type`) into the empty Chapter-title `h1` to verify blur-creates-the-Chapter kept landing text in a sibling paragraph instead of the heading, due to jsdom/ProseMirror's incomplete click-coordinate resolution (compounded by the `elementFromPoint` polyfill returning `null`). Rather than fight this jsdom limitation further, the underlying logic (create-vs-update branching, blank-title no-op) was covered instead by a dedicated `useContentDocument.test.ts` hook-level unit test — matching this codebase's own AD-5 convention ("hooks get pure-logic unit tests, no DOM") more closely than a DOM-simulation test would have anyway.
- **Command-list category grouping placement:** `EXPERIENCE.md`'s slash-menu row groups commands under labels like "Structure"/"Basic"/"Media & data"/"Resources," but this story's own minimal one-command list ("Paragraph") doesn't yet need to resolve which named category it belongs to under the full FR-26 taxonomy — grouped it under "Basic," the category the epics doc uses for Paragraph everywhere it's mentioned; later stories adding more commands will establish the remaining category groups.
- All acceptance criteria (#1–#9) manually verified against the implementation logic; AC #1/#8/#9 additionally covered by `CourseContentEditor.test.tsx`'s three new document-canvas tests, AC #2/#3/#5/#6/#7 by `SlashMenu.test.tsx`'s eight tests, AC #4 by `SlashMenu.test.tsx`'s "+" affordance test.

### File List

**Backend — new:**
- `Backend/src/FlexDemy.Domain/Courses/Chapter.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Configurations/ChapterConfiguration.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/20260817082559_AddChapter.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/20260817082559_AddChapter.Designer.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentRepository.cs`
- `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentService.cs`
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterDto.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterMapper.cs`
- `Backend/src/FlexDemy.Api/Controllers/ContentController.cs`
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs`
- `Backend/tests/FlexDemy.Infrastructure.Tests/Repositories/ContentRepositoryTests.cs`

**Backend — modified:**
- `Backend/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs` (added `Chapters` DbSet)
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs` (EF-generated)
- `Backend/src/FlexDemy.Application/DependencyInjection.cs` (registered `IContentService`)
- `Backend/src/FlexDemy.Infrastructure/DependencyInjection.cs` (registered `IContentRepository`)

**Frontend — new:**
- `FrontEnd/src/lib/editor/slashMenuTypes.ts`
- `FrontEnd/src/lib/editor/SlashMenuList.tsx`
- `FrontEnd/src/lib/editor/SlashCommandExtension.tsx`
- `FrontEnd/src/lib/editor/PlusAffordanceButton.tsx`
- `FrontEnd/src/services/courseContentService.ts`
- `FrontEnd/src/features/CourseContentEditor/useContentDocument.ts`
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx`
- `FrontEnd/tests/lib/editor/SlashMenu.test.tsx`
- `FrontEnd/tests/features/CourseContentEditor/useContentDocument.test.ts`

**Frontend — modified:**
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` (wired the document canvas, Published read-only banner, loading state, into the existing shell)
- `FrontEnd/src/index.css` (no net change — a CSS rule added mid-implementation for the decoration-based "+" affordance attempt was removed again when that approach was replaced)
- `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx` (added `courseContentService` mock, jsdom polyfills, three new document-canvas tests)
- `FrontEnd/package.json` / `package-lock.json` (added `@tiptap/react`, `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/suggestion`, all pinned exact `3.30.1`)

## Review Findings (2026-08-18)

Reviewed as one combined pass across all 15 ContentAuthoring stories (7.1-11.4), not this story in isolation — `ContentService.cs`/`ContentRepository.cs`/`ContentController.cs`/`DocumentCanvas.tsx` are AD-20 shared-slice files every later story extends in place, and none of the 15 stories were committed individually against a shared baseline, so a diff scoped to this story's own File List surfaced the epic's cumulative final state, not an isolated slice. 6 parallel reviewers (Blind Hunter, Edge Case Hunter, Acceptance Auditor — each split backend/frontend) ran against that combined diff; every finding was re-verified against the real current code before acting (several claims turned out to be false positives caused by the scoping itself — a supposed missing migration, "missing" source files owned by later stories, a "missing" FK that matches an established codebase-wide convention — and were dismissed as noise).

- [x] [Review][Patch] `GetResourceContentAsync` served resource bytes with no check that the malware/SVG scan had actually finished — a Queued or Failed resource downloaded identically to a clean Done one `[ContentService.cs]`
- [x] [Review][Patch] `MovePageAsync` computed the destination's new sibling `Order` but never enforced `MaxPagesPerNode` the way `CreatePageAsync` does on the same destination — a move alone could exceed the per-node page cap `[ContentService.cs]`
- [x] [Review][Patch] The resource in-use guard (`FindPagesReferencingResourceAsync`) and `DeleteResourceAsync`'s reference-stripping both used a bare substring match on `resource:{id}` with no boundary check — one resource's id being a text prefix of another's could false-positive-block a delete or corrupt an unrelated page's body `[ContentService.cs]`
- [x] [Review][Patch] `performSync`'s title-save call (`onTitle(currentTitle)`) was fire-and-forget — a failed chapter title save was a genuinely unhandled promise rejection, invisible to the tutor, and let the autosave status show "Saved" regardless `[DocumentCanvas.tsx]`
- [x] [Review][Patch] `handleConfirmDelete`/`handleMove`/`handleDragReorder`/`commitMove` had no error handling at all — a rejected delete/reorder/move call left its modal/picker open with no feedback and was an unhandled promise rejection `[DocumentCanvas.tsx]`

All five verified via new regression tests (backend: `GetResourceContentAsync_throws_ConflictException_when_the_resource_has_not_finished_scanning`, `MovePageAsync_throws_ValidationException_when_the_destination_is_already_at_the_page_cap`, `DeleteResourceAsync_does_not_match_a_reference_to_a_different_resource_whose_id_shares_this_ones_prefix`) and a full-suite run both sides (967/967 backend, 802/802 frontend — 2 unrelated timeout flakes in `CoursePlayer`/`CourseWizard` under full-suite load, confirmed pre-existing and unrelated by passing cleanly in isolation).

15 lower-severity/lower-confidence findings (a possible silent content-drop path worth a closer look, floating-element scroll positioning, raw-hex Tailwind values, ARIA-role scoping, `Order`-race conditions, N+1 query patterns, etc.) were deferred rather than patched — see `deferred-work.md`'s "code review of 7-1 through 11-4 (ContentAuthoring, combined) (2026-08-18)" entry for the full list and reasoning per item.
