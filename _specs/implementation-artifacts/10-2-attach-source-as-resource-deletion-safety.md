---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 10.2: Attach Source as Resource & Deletion Safety

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want the option to attach the file I just extracted from as a downloadable resource on the same page,
So that a curious student can get the original document, not just my edited excerpt.

## Acceptance Criteria

1. **Given** the tutor is inserting from a source file (Story 10.1) **When** the picker is shown **Then** it offers "Also attach this file to this page as a resource," defaulted on, which — when accepted — adds it to the page's Learning Resources block (Epic 8) as an Attachment (FR-22)
2. **Given** a source file has already been extracted from **When** the tutor deletes that source file **Then** the warning states only that it will disappear from the picker and from any page that attached it as a resource — never that already-extracted page text will change, because it will not (FR-23, DD-6)

## Tasks / Subtasks

- [x] Task 1 — Frontend: "Also attach this file as a resource" checkbox in Story 10.1's picker (AC: #1)
  - [x] Extend `InsertFromFilePicker.tsx` (Story 10.1) with a checkbox, **defaulted on** (per AC #1's explicit "defaulted on" — this is an opt-out, not an opt-in), labeled per FR-22's wording
  - [x] On Insert, if checked: call `courseContentService.attachExistingFileAsResource(courseId, ownerType: 'Page', ownerId: pageId, courseFileId, role: 'Attachment')` — **this endpoint already exists**, built by Story 8.1's Task 2 specifically for this "promote an already-scanned source file to a Resource without re-uploading" case. This story is a pure consumer of it, adding no new backend endpoint
  - [x] The attach call and the text-insertion call (Story 10.1's Task 3) are independent — one succeeding and the other failing is a real possible outcome (e.g. the text inserts fine but the attach call has a transient network failure). Surface a distinct, specific error for the attach failure (a toast, matching this app's existing toast conventions) rather than silently swallowing it or rolling back the already-inserted text — the tutor's inserted content is real work already done and must not be discarded because a secondary action failed

- [x] Task 2 — Backend + Frontend: deletion warning copy (AC: #2)
  - [x] **Read `CourseContentEditor.tsx`'s existing file-delete flow completely before editing it** — today's `ConfirmModal` message is a generic `` `Delete "${name}" and its content? This can't be undone.` `` (confirmed by reading the live file), which says nothing about resource attachments and predates this epic's resource-attachment concept entirely
  - [x] The warning must say only that the file disappears from the picker and from any page's Learning Resources block that attached it — **never** imply already-extracted/inserted page text changes, because Story 10.1's insert is copy-on-insert (the inserted Markdown is independent, plain document content from that point on — deleting the source file later has zero effect on it, per Story 10.1's own Dev Notes and the PRD's DD-6). Get this wording right; it's the one thing this story's AC is most explicit about not getting wrong
  - [x] Determining "any page that attached it as a resource" for the warning's own accuracy requires knowing whether this `CourseFile` has ever been promoted via `attachExistingFileAsResource` — ~~`Resource` (Story 8.1's entity) has no `CourseFileId`/source-file FK column~~ **superseded by direct inspection of the live code**: `Resource.CourseFileId` (a nullable, non-FK "soft link" — AD-20 — indexed via `ResourceConfiguration.cs`'s `HasIndex(r => r.CourseFileId)`) already exists and is already populated by `AttachExistingFileAsResourceAsync`, explicitly anticipating this exact story (its own header comment cites FR-23 by name). No `StoredUrl`-matching workaround was needed — a direct `CourseFileId` match is what the schema was already built for
  - [x] Deleting the source `CourseFile` does **not** cascade-delete any `Resource` rows created from it via "Attach existing file" — confirmed by direct inspection of `CourseFileService.DeleteFileAsync` (it never references `IContentRepository`/`Resource` at all, only `ICourseFileRepository`/`IFileStorageService`) and locked in by a new regression test (`DeleteFileAsync_removes_only_the_CourseFile_row_and_never_touches_Resources`) asserting zero `IContentRepository` calls

- [x] Task 3 — Tests
  - [x] `FrontEnd/tests/features/CourseContentEditor/InsertFromFilePicker.test.tsx` (extend Story 10.1's file): the attach checkbox defaults to checked; unchecking it and inserting does not call `attachExistingFileAsResource`; a failed attach call shows its own error without discarding the already-inserted text
  - [x] Backend/frontend test for the delete-warning copy: a source file with at least one `Resource` reference shows the resource-aware warning; a source file with none shows the original message unchanged (no regression for the common case)
  - [x] A regression test confirming deleting a source `CourseFile` after it was both inserted-from (10.1) and attached-as-resource (this story) leaves the inserted page text and the attached `Resource` row both fully intact — see Completion Notes for how this is proven (both Page and Resource rows live behind the same `IContentRepository`, and `DeleteFileAsync_removes_only_the_CourseFile_row_and_never_touches_Resources` proves `DeleteFileAsync` never calls into it at all)

## Dev Notes

- **Builds directly on Story 10.1's picker and Story 8.1's `attachExistingFileAsResource` endpoint** — read both before starting. This story adds no new backend mutation endpoint, only a read-side check for the warning's accuracy and a frontend wiring task.
- **DD-6 (the PRD's own design decision this AC cites) is the load-bearing constraint**: extraction is copy-on-insert, never a live link. Getting the warning copy wrong in the *other* direction (implying live linkage) would actively mislead a tutor into either over-trusting a link that isn't live, or being needlessly afraid to delete a source file that inserted text no longer depends on.
- **Existing code to read before editing:** `CourseContentEditor.tsx`'s current delete-confirm flow (the file being changed), Story 10.1's `InsertFromFilePicker.tsx`, Story 8.1's `AttachExistingFileAsResourceAsync`.
- **Git context:** no new commits since Story 10.1 was authored in this same session.

### Project Structure Notes

- No new files — this story extends `InsertFromFilePicker.tsx` (Story 10.1) and `CourseContentEditor.tsx`'s existing delete-confirm flow.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 10.2] — verbatim Acceptance Criteria
- [Source: _specs/implementation-artifacts/10-1-...md, 8-1-...md] — the picker and the reused attach endpoint
- [Source: FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx] — live code, the delete-confirm flow this story corrects

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **`Resource.CourseFileId` already existed** (added during Story 8.1, indexed, populated by `AttachExistingFileAsResourceAsync`, its own header comment already citing FR-23 by name) — the story's own Task 2 note assuming a `StoredUrl`-matching workaround was written before that field's existence was confirmed against live code. Used it directly: `IContentRepository.GetCourseFileIdsWithResourcesAsync(courseFileIds)` (new method, `ContentRepository.cs`) returns the distinct set of referenced ids in one query; `CourseFileService.GetFilesAsync` calls it once per request and maps `HasAttachedResources` per file. `CourseFileService` now depends on `IContentRepository` directly (not via a service interface) — the same already-established cross-slice pattern `ContentService` itself uses for `ICourseFileRepository`, just in the opposite direction.
- **No EF Core migration needed** — `Resource.CourseFileId` and its index were already part of the `20260817130600_AddResource` migration from Story 8.1.
- **`CourseFileDto`/`CourseFileMapper.ToDto` gained a `HasAttachedResources` parameter** (default `false`) rather than a second DTO shape — `UploadFileAsync` (freshly created, correctly false) and `GetPublishedFilesAsync` (published/student read path, no delete affordance there, irrelevant) both pass the default; only `GetFilesAsync` (the tutor's own editing view, the only place a delete affordance exists) computes it for real.
- **Design decision: the "Also attach..." checkbox and its `attachExistingFileAsResource` call live inside `InsertFromFilePicker.tsx` itself, not in `DocumentCanvas.tsx`'s `commitInsertFromFile`.** Originally drafted the other way (parent owns the attach call, picker only reports checkbox state via an `onInsert(markdown, attachFileId)` tuple) — reworked once Task 3's own test-file placement became clear: "a failed attach call shows its own error" is listed under `InsertFromFilePicker.test.tsx`, which is only testable from inside that file if the picker itself makes the call. The picker now takes `courseId`/`pageOwner` props and calls `attachExistingFileAsResource` directly on Insert; `onInsert(markdown)` and `onClose()` fire synchronously first (the attach call is a genuinely independent, fire-and-forget promise afterward) so the tutor's text insertion is never delayed by, or rolled back because of, a slow or failing attach call. A resulting `onResourceAttached(fileId, resource)` callback lets `DocumentCanvas.tsx` reflect the new Resource in the live document without a full `onReload()` (which would rebuild the doc from stale server state and silently discard the just-inserted, not-yet-autosaved text — a real bug this design deliberately avoids).
- **`appendAttachedResourceToPage` (`DocumentCanvas.tsx`)**: if a `learningResourcesBlock` node already exists for this Page in the live document, its `resources` attr is updated directly via `tr.setNodeAttribute` (mirrors `LearningResourcesNodeView.tsx`'s own `setResources`/`updateAttributes` pattern, invoked from outside that NodeView). If none exists yet, a new one is inserted at the end of the Page's body, seeded with just this resource — the same insertion shape the "Learning Resources" slash command itself already uses. Neither path touches `onReload()`.
- **`useFileUpload.ts` gained `markResourceAttached(id)`** so the tutor's own file-list state (`hasAttachedResources`, which drives the delete-warning's accuracy) updates the instant an attach succeeds, rather than staying stale until the next `getFiles()` poll/reload — closes a real gap where a tutor could insert-and-attach a file then immediately try to delete it in the same session and see the wrong (unaware) warning.
- **Deletion-warning wording** (`CourseContentEditor.tsx`): `Delete "{name}"? It will disappear from the "Insert from file" picker and from any page's Learning Resources where it's attached as a resource. Text already inserted from this file elsewhere won't change.` — names only what actually happens and explicitly reassures on the one thing DD-6 says must never be implied. The original, unchanged message stays for files with no attached resources (regression-tested).
- All 774 frontend tests and 925 backend tests (558 Application + 226 Infrastructure + 141 Api) pass with zero regressions.

### File List

- `Backend/src/FlexDemy.Application/Courses/IContentRepository.cs` — MODIFIED: added `GetCourseFileIdsWithResourcesAsync`
- `Backend/src/FlexDemy.Infrastructure/Repositories/ContentRepository.cs` — MODIFIED: implemented it
- `Backend/src/FlexDemy.Application/Courses/CourseFileDto.cs` — MODIFIED: added `HasAttachedResources`
- `Backend/src/FlexDemy.Application/Courses/CourseFileMapper.cs` — MODIFIED: `ToDto` takes `hasAttachedResources`
- `Backend/src/FlexDemy.Application/Courses/CourseFileService.cs` — MODIFIED: depends on `IContentRepository`; `GetFilesAsync` computes `HasAttachedResources` per file
- `Backend/tests/FlexDemy.Application.Tests/Courses/CourseFileServiceTests.cs` — MODIFIED: `IContentRepository` substitute wired into `MakeSut`; new `HasAttachedResources` and `DeleteFileAsync` tests
- `Backend/tests/FlexDemy.Infrastructure.Tests/Repositories/ContentRepositoryTests.cs` — MODIFIED: new `GetCourseFileIdsWithResourcesAsync` tests
- `FrontEnd/src/services/courseFileService.ts` — MODIFIED: `CourseFileDto.hasAttachedResources`
- `FrontEnd/src/features/CourseContentEditor/useFileUpload.ts` — MODIFIED: `FileUploadEntry.hasAttachedResources`, new `markResourceAttached`
- `FrontEnd/src/features/CourseContentEditor/InsertFromFilePicker.tsx` — MODIFIED: attach checkbox, owns the `attachExistingFileAsResource` call and its own error toast
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` — MODIFIED: `insertFileTarget` now carries `pageOwner`; new `appendAttachedResourceToPage`/`handleResourceAttached`; picker wired with `courseId`/`pageOwner`/`onResourceAttached`
- `FrontEnd/src/features/CourseContentEditor/CourseContentEditor.tsx` — MODIFIED: `deleteFileTarget` carries `hasAttachedResources`; conditional warning message; threads `markResourceAttached` to `DocumentCanvas` as `onFileAttached`
- `FrontEnd/tests/features/CourseContentEditor/InsertFromFilePicker.test.tsx` — MODIFIED: `courseId`/`pageOwner`/`onResourceAttached` props, `attachExistingFileAsResource`/`useToast` mocks, new attach-behavior tests
- `FrontEnd/tests/features/CourseContentEditor/CourseContentEditor.test.tsx` — MODIFIED: `hasAttachedResources` added to DTO fixtures; two new delete-warning tests
- `FrontEnd/tests/features/CourseContentEditor/useFileUpload.test.ts` — MODIFIED: `hasAttachedResources` added to DTO fixture
- `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx` — MODIFIED: `hasAttachedResources` added to a DTO fixture
- `FrontEnd/tests/features/CoursePlayer/CoursePlayer.test.tsx` — MODIFIED: `hasAttachedResources` added to a DTO fixture

### Change Log

- 2026-08-17: Story 10.2 implemented — attach-existing-file checkbox in the Insert-from-file picker (Task 1), backend `HasAttachedResources` computation + accurate delete-confirmation warning (Task 2), tests (Task 3). Status: review.
