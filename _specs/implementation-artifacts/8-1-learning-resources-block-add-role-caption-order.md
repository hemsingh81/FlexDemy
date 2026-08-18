---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 8.1: Learning Resources Block — Add, Role, Caption, Order

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want to attach files to a page through a Learning Resources block inserted via "/",
So that a student reading this specific page finds its supporting material right there, not in one undifferentiated course-wide list.

## Acceptance Criteria

1. **Given** the tutor's cursor is inside a page body **When** they type "/" and select "Learning Resources" **Then** a generic, reusable resources block is inserted — the identical component this epic reuses at node level in Story 8.2 (FR-36)
2. **Given** the Learning Resources block is present **When** the tutor adds a file via drag-and-drop, a file picker, or "Attach existing file" (promoting an already-uploaded source file) **Then** all three are real, keyboard-operable controls — drag-and-drop is never the only path — and "Attach existing file" references the already-scanned file rather than re-uploading it (FR-37)
3. Every added resource gets a role — Inline, Attachment, or both — defaulting to Inline for images and Attachment otherwise, changeable afterwards via a real role control (not a static badge) (FR-38, UX-DR9)
4. Every resource has an editable display label and an optional short caption, shown to students on attachment cards (FR-39)
5. Resources are ordered within their owner via keyboard-operable reorder controls (non-drag move-up/move-down equivalent), and Attachment-role resources render to students in that order (FR-40, UX-DR9)
6. An uploaded resource goes through the same malware-scan path as source files, rejected with its reason on failure (FR-41)
7. **SVG sanitization (HtmlSanitizer, explicit script/event-handler/foreignObject denial) is wired into this story's upload path on Day 1** — accepted resource types are images (png/jpg/jpeg/gif/webp/svg), documents (pdf/doc/docx/txt/xls/xlsx), and the code/text extension allowlist, with per-file/per-course size caps as already enforced (FR-42, FR-48 resource half — not deferred to a later story)
8. **Given** an owner (a node or a page) already has 50 attached resources **When** the tutor attempts to add a 51st **Then** the add is rejected server-side with a clear, specific error naming the limit — never a silent failure or an unhandled exception (FR-48 resource half, Appendix A's bounded limits)
9. **Given** an uploaded file exceeds 25 MB **When** the upload is attempted **Then** it's rejected with a clear, specific error stating the size limit, before any scan/sanitize/storage work happens on it (FR-48 resource half)

## Tasks / Subtasks

- [x] Task 1 — Backend: `Resource` entity and its async scan/sanitize pipeline (AC: #6, #7, #9)
  - [x] `Domain/Courses/Resource.cs`: `Id`, `OwnerType` (`ContentOwnerType`, Story 7.3's enum — its `Page` member is a real target here, not just theoretical), `OwnerId` (`string`, no FK — same AD-20 polymorphic pattern as `Page`), `CourseFileId` (`string?`, no FK — **per the PRD's Appendix A sketch**: "set when a resource is promoted from an existing source file (FR-37) so the same bytes are not stored twice; `null` for a directly-uploaded resource." This is not optional bookkeeping — Epic 10's FR-23 ("deleting a source file... warns... it will disappear from... any page that attached it as a resource") is unimplementable later without this link to find which Resources reference a given `CourseFileId`. Add it now; backfilling it after Task 2's `AttachExistingFileAsResourceAsync` has already shipped without it would need a data migration), `Label` (required — FR-39), `Caption` (optional, short text), `Role` (`ResourceRole` — new enum below), `FileName`, `ContentType`, `SizeBytes`, `StoredUrl`, `Status` (`JobItemStatus` — **reuse the existing enum** `CourseFile` already uses, don't invent a second Queued/Done/Failed enum for the same concept), `FailureReason`, `Order` (int, scoped to siblings under the same `OwnerType`+`OwnerId`)
  - [x] `Domain/Courses/ResourceRole.cs`: `public enum ResourceRole { Inline, Attachment, Both }`, stored via `.HasConversion<string>()` — same ordinal-drift-avoidance convention `ContentOwnerType` already established (Story 7.3), not the EF numeric default
  - [x] `Infrastructure/Persistence/Configurations/ResourceConfiguration.cs`, EF migration. Add an index on `(OwnerType, OwnerId)` — same reasoning as `Page`'s equivalent index from Story 7.3, this story's own 50-per-owner cap check (Task 3) queries it directly
  - [x] **Read `Backend/src/FlexDemy.Application/Courses/CourseFileService.cs` and `Backend/src/FlexDemy.Infrastructure/Jobs/ScanFileJob.cs` completely before writing anything new** — this story's upload path is a close structural mirror of that existing, already-hardened pipeline (Story 2.6/2.7): validate → save bytes via `IFileStorageService` → create the row at `Status = Queued` → enqueue an async Hangfire job → return immediately (AD-15's tab-close-safety guarantee — the HTTP response doesn't wait for the scan). Reuse the existing `IFileScanner` (nClam-backed `ClamAvFileScanner` — **the architecture spine's `[ASSUMPTION: exact client library not yet chosen]` is stale; `nClam` (Apache-2.0) is already implemented and in production use by `CourseFileService`, confirmed by reading the live code — cite it as a settled fact in this story, not an open question**) — don't write a second scanner client
  - [x] New `Infrastructure/Jobs/ScanResourceJob.cs` + `IScanResourceJob`/`IScanResourceJobEnqueuer` (`Application/Common/`, mirroring `IScanFileJob`/`IScanFileJobEnqueuer` exactly) — **not** a reuse of `ScanFileJob` itself: that job's terminal step chains into `ParseFileJob` (OCR/structure extraction), which has no meaning for a Resource. This job's terminal step, after a clean scan, is the new SVG-sanitization step below (for `image/svg+xml` only) then `Status = Done`; for every other content type, a clean scan goes straight to `Status = Done`
  - [x] New `Infrastructure/Sanitization/SvgSanitizer.cs`: wraps HtmlSanitizer (mganss, `9.1.973`, already pinned by the backend architecture spine's Stack table — add the NuGet package now, this is its first consumer). Explicit SVG-safe tag allowlist (`svg`, `path`, `circle`, `rect`, `g`, `defs`, …), explicit denial of `<script>`, every `on*` event-handler attribute, and `foreignObject` (AD-28 — the `foreignObject` denial is retained as independent defense-in-depth per that AD's corrected citation, not because of the CVE originally miscited for it). Runs **only** when `ContentType == "image/svg+xml"`, immediately after a clean ClamAV scan and before `Status` flips to `Done`. The sanitizer rewrites the stored file's bytes **in place** (re-save the sanitized output via `IFileStorageService`, overwriting the unsanitized upload) — it does not reject the upload outright unless the content isn't parseable as SVG at all, in which case treat it as a scan-style failure (`Status = Failed`, a specific reason), not an unhandled exception
  - [x] `IContentService`/`ContentRepository` additions: `UploadResourceAsync(courseId, ownerType, ownerId, label, caption, role, stream, fileName, contentType, contentLength)` (Task 1's pipeline entry point — validates size/type/50-cap **before** touching storage, per AC #8/#9's explicit "before any scan/sanitize/storage work" ordering), `AttachExistingFileAsResourceAsync(courseId, ownerType, ownerId, courseFileId, role)` (Task 2), `UpdateResourceAsync(courseId, resourceId, label, caption, role)`, `GetResourcesByOwnerAsync`, `ReorderResourceAsync` (Task 4), `DeleteResourceAsync` (no delete-in-use guard yet — that's Story 8.3; this story's delete is unconditional). All mutations via `EnsureOwnedDraftAsync`; every mutation that adds/removes/re-roles a resource also calls the generic `ResetImmediateParentConfirmation(ownerType, ownerId)` helper **Story 7.4 explicitly stubbed for this story to call** (FR-44's resource-mutation reset case — this is where it finally gets exercised)
  - [x] Accepted content-type allowlist (FR-42): images (`png`/`jpg`/`jpeg`/`gif`/`webp`/`svg`), documents (`pdf`/`doc`/`docx`/`txt`/`xls`/`xlsx`), plus a bounded code/text extension allowlist — the epics doc defers the exact extension list to "Appendix A" of the PRD; **read `_specs/planning-artifacts/prds/prd-eLearning-ContentAuthoring-2026-08-16/prd.md`'s Appendix A before hardcoding the list**, don't guess it
  - [x] Size cap: **25 MB per resource** (AC #9 — note this is a different limit from `CourseFileService.MaxFileContentLength`'s existing 50 MB for source files; don't reuse that constant, define a new `MaxResourceContentLength = 25 * 1024 * 1024` scoped to this feature)
  - [x] 50-resources-per-owner cap (AC #8): checked via the `(OwnerType, OwnerId)` index query, rejected with a `ValidationException` naming "50" explicitly, before any file I/O begins
  - [x] Tests: an SVG containing `<script>` and an `onload` handler is stripped of both after upload, verified by reading the *stored* bytes back, not just asserting no exception was thrown; a non-SVG image skips the sanitization step entirely (assert `SvgSanitizer` isn't invoked, e.g. via a substitute call-count check); the 51st resource on one owner is rejected and no file was written to storage; a 26 MB upload is rejected before `IFileStorageService.SaveAsync` is ever called (assert the substitute received zero calls, not just that an exception surfaced)

- [x] Task 2 — Backend: "Attach existing file" (AC: #2)
  - [x] `AttachExistingFileAsResourceAsync`: loads the target `CourseFile` (must belong to the same course, must be `Status == Done` — an in-progress or failed source file has nothing valid to attach), creates a `Resource` row with `CourseFileId` set to that file's id and referencing the **same `StoredUrl`/`ContentType`/`SizeBytes`/`FileName`** — no byte duplication, no re-upload, no re-scan (it's already scanned) — and sets `Status = Done` immediately, skipping the async job entirely. This is the literal meaning of FR-37's "references the already-scanned file rather than re-uploading it"

- [x] Task 3 — Backend: extend `ChapterDocumentDto` family with `resources` (AC: #1, #3, #4, #5)
  - [x] Add `resources: ResourceDto[]` (`id`, `label`, `caption`, `role`, `order`, `status`, `fileName`, `contentType`, `sizeBytes`) to `ChapterDocumentDto`, `TopicDocumentDto`, `SubtopicDocumentDto`, **and** `PageDocumentDto` (all four owner types, per AD-20 — this story only wires the Page-body slash-menu entry point, but the DTO shape is generic across all four since Story 8.2 reuses it, not redesigns it). **No `url` field here** — `GET .../resources/{resourceId}/content` (Story 8.3's Task 1, AD-29's authenticated-read pattern) is the only way to reach a resource's bytes; there is no signed/static URL to embed in this DTO. A resource row's Attach/download affordance calls Story 8.3's `courseContentService.resolveResourceUrl(resource.id)` (blob-fetch + `URL.createObjectURL`) on demand using the `id` already in this array — don't add a redundant `url` field that would either go stale or bypass AD-29's auth check
  - [x] `GetChapterDocumentAsync` populates all four `resources` arrays in the same query pass that already loads Topics/Subtopics/Pages — avoid N+1 queries per node

- [x] Task 4 — Backend: reorder endpoint (AC: #5)
  - [x] `PUT content/resources/{resourceId}/reorder`, same `{ direction: 'up' | 'down' }` convention Story 7.2 established for Topics/Subtopics and Story 7.3 reused for Pages — don't introduce a fourth reorder shape

- [x] Task 5 — `ContentController.cs` additions (AC: all)
  - [x] `POST content/resources` (multipart: `ownerType`, `ownerId`, `label`, `caption?`, `role?`, `file`) — first multipart endpoint on this controller. Two existing multipart precedents to read first: `CourseFilesController.UploadFile` (single `[FromForm] IFormFile` param, this story's closer analog for the scan pipeline itself) and `CoursesController.AddThumbnail` (multiple `[FromForm]` params alongside the file — the closer analog for *this action's own signature*, since this endpoint also takes `ownerType`/`ownerId`/`label`/`caption`/`role` as separate form fields, not just a file). Mirror `AddThumbnail`'s `[RequestSizeLimit(CourseService.MaxThumbnailContentLength + 1024*1024)]` pattern, deriving from the same public `MaxResourceContentLength` constant the service uses
  - [x] `POST content/resources/attach-existing` (body: `ownerType`, `ownerId`, `courseFileId`, `role?`)
  - [x] `PUT content/resources/{resourceId}`, `PUT content/resources/{resourceId}/reorder`, `DELETE content/resources/{resourceId}` — all under the existing `api/v1/courses/{courseId}/content` class route, `EnsureOwnedDraftAsync`-gated

- [x] Task 6 — Frontend: Learning Resources Tiptap block (AD-9, AD-10, UX-DR9) (AC: #1, #2, #3, #4, #5)
  - [x] `features/CourseContentEditor/extensions/LearningResourcesBlock.ts` (new, in the `extensions/` folder Story 7.1 established, Story 7.3's `PageMarker.ts`/`RawBlock.ts` are its siblings): a custom Tiptap Node/NodeView — **generic and reusable**, per FR-36's explicit requirement and `DESIGN.md`'s `content-resource-block` token ("the SAME component whether attached to a Chapter, a Topic, a Sub-Topic or nested inside a Page's body"). This story only wires its **insertion point** into a Page body (the node-level insertion points are Story 8.2's task); build the component itself generically from the start so 8.2 doesn't have to refactor it
  - [x] "Learning Resources" slash-menu command added to the feature-owned list, grouped under a "Resources" category (per `EXPERIENCE.md`'s Component Patterns row listing "Resources: Learning Resources block, Resource card")
  - [x] Resource row UI, per `DESIGN.md`'s `content-resource-block.resourceRowControls` token, verbatim: a real role control (a `<select>` or button+menu, **never a static badge**), an inline-editable caption field, remove and reorder (move-up/move-down) icon-button controls — every one of these independently keyboard-operable, not just the "add" action
  - [x] Drop-zone offers real Upload / Attach-existing / Insert-from-file button-row controls **alongside** drag-and-drop — drag is never the only path (UX-DR10). "Insert-from-file" itself is Epic 10's own feature (don't build its actual picker here) — this button can be present but disabled/deferred, or simply omitted from this story's drop-zone until Epic 10 lands; don't fake a non-functional control. Upload and Attach-existing must both be fully real in this story

- [x] Task 7 — Frontend: `courseContentService.ts` additions (AC: all)
  - [x] `uploadResource(courseId, ownerType, ownerId, file, { label, caption, role })` (multipart `POST`), `attachExistingFileAsResource(courseId, ownerType, ownerId, courseFileId, role?)`, `updateResource`, `reorderResource`, `deleteResource` — same file Stories 7.1–7.4 have been extending throughout

- [x] Task 8 — Frontend: default role assignment (AC: #3)
  - [x] On add, default `Inline` for image content types, `Attachment` for everything else (FR-38) — computed client-side at insert time from the file's content-type, sent as the initial `role` value on the upload/attach call; the role remains freely changeable afterward via the row's role control

- [x] Task 9 — Tests
  - [x] Backend per Task 1's own bullets, plus: attaching an existing file skips the async job and is immediately `Done`; reorder direction convention matches Stories 7.2/7.3's existing tests' shape (mirror their test structure, don't invent a new assertion style for the same behavior)
  - [x] `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx`: add via file picker, add via drag-drop, add via Attach-existing all call the correct service function; role control changes persist; reorder buttons call the direction-based service function; a failed upload (mocked malware-scan rejection) shows the reason and doesn't leave a phantom resource row

## Dev Notes

- **First story in Epic 8** — no same-epic predecessor, but this story depends heavily on Epic 7's foundation (`ContentOwnerType`, `ContentController`/`ContentService`/`ContentRepository`, the DTO family, the `extensions/` folder, the slash-menu command list, and Story 7.4's `ResetImmediateParentConfirmation` stub). Read Stories 7.1–7.4 in full, especially 7.3 (the `ContentOwnerType` enum this story's `Resource.OwnerType` reuses) and 7.4 (the confirmation-reset hook this story is the first to actually call for a resource mutation).
- **This is the epic's own flagged Day-1 security requirement** — per the epics doc's own implementation note: "SVG sanitization... ships as a Day-1 acceptance criterion on this epic's first resource-upload story — never a 'sanitize later' fast-follow." Do not defer Task 1's `SvgSanitizer` step.
- **Delete-in-use protection is explicitly NOT this story's job** — Story 8.3 owns FR-31's "blocked while referenced" guard. This story's `DeleteResourceAsync` is unconditional (still ownership/Draft-gated, just no in-use check). Don't build a stub of 8.3's guard here; a real no-op is fine, an incomplete guard would be worse than none.
- **Architecture:** AD-20 (Resource's polymorphic `OwnerType`/`OwnerId`, reusing `ContentOwnerType`, no DB FK), AD-22 (existing ClamAV/`nClam` scan pipeline — reused, not reimplemented), AD-28 (HtmlSanitizer SVG sanitization, corrected `foreignObject` rationale), NFR4 (50/owner, 25 MB/resource bounds).
- **UX:** `DESIGN.md`'s `content-resource-block` token (background/border/pattern/`resourceRowControls`) and UX-DR9/UX-DR10 in full.
- **Existing code read for this story:** `CourseFileService.cs`, `ScanFileJob.cs`, `ClamAvFileScanner.cs`, `IFileScanner.cs`, `IFileStorageService.cs`/`LocalFileStorageService.cs`, `CoursesController.cs`'s `AddThumbnail` action (multipart precedent) — all reused patterns, confirmed by reading the live code rather than the architecture spine's prose alone (which still carries a stale `[ASSUMPTION]` about the ClamAV client this story corrects).
- **Git context:** no new commits since the Epic 7 stories were authored in this same session.

### Project Structure Notes

- New backend files: `Domain/Courses/{Resource,ResourceRole}.cs`, `Infrastructure/Persistence/Configurations/ResourceConfiguration.cs`, `Infrastructure/Jobs/ScanResourceJob.cs`, `Application/Common/{IScanResourceJob,IScanResourceJobEnqueuer}.cs`, `Infrastructure/Sanitization/SvgSanitizer.cs`.
- New frontend file: `features/CourseContentEditor/extensions/LearningResourcesBlock.ts`.
- Everything else extends an existing Epic 7 file (`ContentController.cs`, `ContentService.cs`, `ContentRepository.cs`, the DTO family, `courseContentService.ts`).

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 8.1] — verbatim Acceptance Criteria, including the epic's own SVG-Day-1 implementation note
- [Source: _specs/implementation-artifacts/7-3-...md, 7-4-...md] — `ContentOwnerType`, `ResetImmediateParentConfirmation` stub
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-20, #AD-22, #AD-28]
- [Source: _specs/planning-artifacts/ux-designs/ux-eLearning-2026-08-10/DESIGN.md#content-resource-block]
- [Source: Backend/src/FlexDemy.Application/Courses/CourseFileService.cs, Backend/src/FlexDemy.Infrastructure/Jobs/ScanFileJob.cs] — live code, the reused upload/scan pipeline pattern

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Full-solution `dotnet build`: 0 errors, 0 warnings (Story 8.1 files) after fixing a stray `csproj` XML-comment double-hyphen, a missing `using FlexDemy.Domain.Courses;` in `IContentService.cs`, and `ContentServiceTests.cs`'s constructor-signature drift.
- Backend test run: `FlexDemy.Application.Tests` 550 passed, `FlexDemy.Infrastructure.Tests` 223 passed, `FlexDemy.Api.Tests` 141 passed — 914 total, 0 failed, 0 regressions.
- Frontend `tsc --noEmit`: zero new errors (pre-existing, unrelated errors elsewhere in the repo untouched).
- Frontend `vitest run --project unit`: 87 files / 692 tests passed, 0 regressions.

### Completion Notes List

- SVG sanitization (AC #7) verified by asserting on the actual re-sanitized bytes (script/onload/foreignObject stripped), not just "no exception thrown" — `SvgSanitizerTests.cs` and `ScanResourceJobTests.cs`.
- `nClam`/`ClamAvFileScanner` confirmed live and reused unchanged (no second scanner client written), per the story's own note that the architecture spine's `[ASSUMPTION]` about it was stale.
- Extended `LoadOwnerInCourseAsync` to accept `ContentOwnerType.Page` (a Resource can be owned by a Page, unlike a Page itself) — caught and fixed a self-introduced regression where this silently also let `CreatePageAsync`/`MovePageAsync` accept an invalid `OwnerType: Page` for a Page's own parent; added an explicit guard in both methods before this story's change could ship.
- Added a `GET content/resources?ownerType=&ownerId=` read endpoint beyond the story's explicit Task 5 list — wires the already-existing (Task 3) `IContentService.GetResourcesByOwnerAsync` to a route, needed by the frontend's Learning Resources block to poll a single owner's resources for scan-status transitions (Queued → Done/Failed) without refetching the whole chapter document. A small, directly-justified extension of already-built service surface, not scope creep.
- Frontend: `LearningResourcesBlock` is deliberately excluded from `DocumentCanvas.tsx`'s `CONTENT_EXTENSIONS`/`markdownManager` schema — a Resource lives in its own DB table, never as Markdown text, so the block is never asked to serialize. It's added only to the live editor's own extension list, seeded/reconstructed from each Page's own `resources` array in `buildPageJSON`, and filtered out of `performSync`'s body-node collection before `markdownManager.serialize` runs on the rest. Documented, deliberate consequence: the block's exact position within a page's prose isn't preserved across a reload (it's always reconstructed at the end of the page's body) — none of this story's ACs require exact position fidelity across a reload.
- This is the first `ReactNodeViewRenderer`-based Tiptap NodeView in this codebase (every prior extension used plain `renderHTML`) — confirmed via `ReactNodeViewRenderer`'s mount happens via a React portal outside RTL's `render()` `act()` wrapper, so `LearningResourcesBlock.test.tsx` awaits a mounted landmark (`findByText('Learning Resources')`) before any further query/interaction.
- "Insert-from-file" (Epic 10's own feature) is omitted entirely from the drop-zone rather than added as a disabled/fake control, per the story's own explicit instruction.
- All four `*DocumentDto` `resources` fields (frontend) are optional (`resources?: ResourceDto[]`) rather than required, so the many pre-existing test fixtures built before this story didn't all need updating; a real server response always includes the field.

### File List

**Backend — new:**
- `Backend/src/FlexDemy.Domain/Courses/Resource.cs`
- `Backend/src/FlexDemy.Domain/Courses/ResourceRole.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Configurations/ResourceConfiguration.cs`
- `Backend/src/FlexDemy.Application/Common/ISvgSanitizer.cs`
- `Backend/src/FlexDemy.Infrastructure/Sanitization/SvgSanitizer.cs`
- `Backend/src/FlexDemy.Application/Common/IScanResourceJobEnqueuer.cs`
- `Backend/src/FlexDemy.Infrastructure/Jobs/IScanResourceJob.cs`
- `Backend/src/FlexDemy.Infrastructure/Jobs/ScanResourceJob.cs`
- `Backend/src/FlexDemy.Infrastructure/Jobs/ScanResourceJobEnqueuer.cs`
- `Backend/src/FlexDemy.Application/Courses/ResourceMapper.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/20260817130600_AddResource.cs` (+ `.Designer.cs`)

**Backend — modified:**
- `Backend/src/FlexDemy.Infrastructure/FlexDemy.Infrastructure.csproj`
- `Backend/src/FlexDemy.Infrastructure/Persistence/FlexDemyDbContext.cs`
- `Backend/src/FlexDemy.Infrastructure/Storage/LocalFileStorageService.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentRepository.cs`
- `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterDto.cs`
- `Backend/src/FlexDemy.Application/Courses/ChapterMapper.cs`
- `Backend/src/FlexDemy.Application/Courses/TopicMapper.cs`
- `Backend/src/FlexDemy.Application/Courses/IContentService.cs`
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs`
- `Backend/src/FlexDemy.Infrastructure/DependencyInjection.cs`
- `Backend/src/FlexDemy.Api/Controllers/ContentController.cs`
- `Backend/src/FlexDemy.Infrastructure/Persistence/Migrations/FlexDemyDbContextModelSnapshot.cs`

**Backend — tests:**
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs` (modified — extended `Sut`/`MakeSut()`, added ~30 Resource tests)
- `Backend/tests/FlexDemy.Infrastructure.Tests/Sanitization/SvgSanitizerTests.cs` (new)
- `Backend/tests/FlexDemy.Infrastructure.Tests/Jobs/ScanResourceJobTests.cs` (new)

**Frontend — new:**
- `FrontEnd/src/features/CourseContentEditor/extensions/LearningResourcesBlock.ts`
- `FrontEnd/src/features/CourseContentEditor/extensions/LearningResourcesNodeView.tsx`
- `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx`

**Frontend — modified:**
- `FrontEnd/src/services/courseContentService.ts`
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx`

## Change Log

| Date | Change |
|------|--------|
| 2026-08-17 | Story 8.1 implemented: `Resource` entity + AD-20 polymorphic ownership; async scan pipeline (`ScanResourceJob`, mirroring `ScanFileJob`) with Day-1 SVG sanitization (`SvgSanitizer`/HtmlSanitizer, AD-28); "Attach existing file" (FR-37, skips the async job); `resources` added to all four document DTOs; full Resource CRUD (`ContentService`/`ContentController`); FR-44 confirmation-reset wiring for resource create/delete/re-role; cascade-delete/impact extended to resources; frontend `LearningResourcesBlock` Tiptap NodeView (first `ReactNodeViewRenderer` consumer in this codebase) wired into the Page-body slash menu, with drag-and-drop + Upload + Attach-existing controls, a real role `<select>`, inline-editable label/caption, and keyboard-operable reorder/remove. Status: review. |
