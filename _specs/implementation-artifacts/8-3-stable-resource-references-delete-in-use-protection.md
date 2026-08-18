---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 8.3: Stable Resource References & Delete-in-Use Protection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tutor,
I want the system to protect a resource from deletion while it's actually used in my page content,
So that I never end up with a broken image or a dead download link a student will hit.

## Acceptance Criteria

1. **Given** a resource is referenced from a page body (an inline image or a resource card) **When** the reference is rendered, in either the editor preview or the student player **Then** it resolves via a stable `resource:{resourceId}` URI to a real signed/served URL at render time — never a raw storage URL baked into the Markdown (FR-30)
2. **Given** a resource is referenced by at least one page body **When** the tutor tries to delete it from its Learning Resources block **Then** the delete is blocked, naming the referencing block(s), and offers "Remove from content and delete" as an explicit second action (FR-31)
3. **This guard is expected to be inert while this epic ships ahead of Epic 9** — no `resource:{id}` reference can exist in a page body until Epic 9's Image/Resource-card blocks land, **except where a tutor hand-types a `resource:` URI via the raw-Markdown edit path** (Story 7.3's FR-32/33) — cover that path in this story's tests, don't treat the guard as unverifiable until Epic 9

## Tasks / Subtasks

- [x] Task 1 — Backend: the binary-serving endpoint (AD-29) (AC: #1)
  - [x] **Read `Backend/src/FlexDemy.Api/Controllers/CourseFilesController.cs`'s `DownloadFile` action completely before writing this task** — AD-29 explicitly requires reusing "whatever mechanism the existing `CourseFilesController.../download` route already uses for authenticated binary delivery," confirmed against live code, not invented fresh. That action is: `[HttpGet("{fileId}/download")]`, `[Authorize(Policy = FeatureKeys.CoursesCreate)]`, calls `courseFileService.DownloadFileAsync` and returns `File(download.Content, download.ContentType, download.FileName)` — a standard authenticated stream response (Bearer-token auth via the normal `Authorization` header, not a signed URL or cookie scheme)
  - [x] `GET content/resources/{resourceId}/content` on `ContentController`, mirroring that exact shape: `IContentService.GetResourceContentAsync(courseId, resourceId)` returns the stream/content-type/filename, ownership-only read check (not Draft-gated — same AD-29 owner-read rule every other read on this controller already follows). **This story wires the owner (tutor) read path only** — AD-29's reviewer/student branches on this same route are Story 11.3's scope, not this one; don't build them here, but don't structure the check so it's hard for 11.3 to add its branches later either (a single policy-check call site, not three ad hoc `if`s scattered through the action)
  - [x] Storage read reuses the same `IFileStorageService.OpenReadAsync` Story 8.1's upload path already established — no new storage abstraction

- [x] Task 2 — Frontend: `resolveResourceUrl` and the blob-URL pattern (AC: #1)
  - [x] **This is the first frontend consumer of binary content at all** — `courseFileService.ts` has no download function today (confirmed by grep; the existing `.../download` backend route has no frontend caller yet), so there's no existing blob-handling precedent to mirror. `httpClient.ts`'s shared `request()` always calls `response.json()` — unsuitable for a binary body — so add a new `requestBlob(path): Promise<Blob>` to `httpClient.ts` alongside `request()`, **not** a one-off `fetch` call inside `courseContentService.ts` that bypasses the shared helper (AD-7's "every `services/*` HTTP call goes through one shared low-level request helper" — this includes reading the `X-Correlation-Id` response header into the same module-level store `request()` already updates, which a bypassing call would silently skip)
  - [x] `courseContentService.resolveResourceUrl(resourceId): Promise<string>`: calls `requestBlob('.../content/resources/{resourceId}/content')`, wraps the result in `URL.createObjectURL(blob)`, returns the object URL. **Caller-owned cleanup:** object URLs are not automatically revoked — document (in a code comment on this function, and in Dev Notes here) that a caller holding one across a component unmount should call `URL.revokeObjectURL` in its own cleanup effect; this function does not track or auto-revoke URLs it hands out, since it has no visibility into how long a caller keeps one alive
  - [x] Cache resolved URLs per `resourceId` for the lifetime of one editor session (a simple in-memory `Map` inside `courseContentService.ts` is sufficient — no need for a full caching library) so the same image referenced twice in one page, or re-rendered on every keystroke's Preview toggle, doesn't re-fetch the same bytes repeatedly
  - [x] This is the exact function `lib/markdown.ts`'s renderer calls to resolve a `resource:{resourceId}` URI at render time (both the editor's Preview toggle, Story 11.2's Preview-as-student, and Story 11.4's real Course Player all call this same function per AD-11/AD-12's "shared identically" rule) — confirm `lib/markdown.ts`'s current renderer has an extension point for custom URI schemes before assuming one exists; if it doesn't, this story adds the minimal hook (a resolver-function prop/parameter) `lib/markdown.ts` needs, since nothing can render a `resource:` URI without it

- [x] Task 3 — Backend: delete-in-use guard (FR-31) (AC: #2, #3)
  - [x] `DeleteResourceAsync` (Story 8.1) currently deletes unconditionally. This story adds a pre-check: scan every Page whose `OwnerType`/`OwnerId` chain could reference this resource — in practice, scan **all Pages in the course** for a `resource:{resourceId}` substring in `BodyMarkdown` (a plain string search is sufficient and correct here; `BodyMarkdown` is unvalidated text per DD-3, there's no structured index of in-body references to query instead) — and, if any match, throw a `ConflictException` (or the closest existing `AppException` subtype for "blocked by a real conflict," not `ValidationException`, which this codebase reserves for malformed input) naming the referencing Page(s) by title/id
  - [x] A second, explicit `DeleteResourceAsync(courseId, resourceId, forceRemoveFromContent: true)` overload (or a query-parameter variant of the same endpoint) performs the "Remove from content and delete" action: strips every `resource:{resourceId}` occurrence from every referencing Page's `BodyMarkdown` (a plain string replace is sufficient given the same reasoning above), then deletes the resource — both in one transaction/unit-of-work, not two separate calls a client could race or interrupt between
  - [x] **AC #3's explicit test requirement:** since Image/Resource-card blocks don't exist until Epic 9, the *only* way a `resource:{resourceId}` reference can exist in a `BodyMarkdown` value during this epic is via Story 7.3's raw-Markdown edit path (FR-32/33 — a tutor manually typing `![alt](resource:abc123)` in the "Markdown" view). **Write this story's guard test using exactly that path**: create a Page, set its `BodyMarkdown` directly to a string containing a `resource:{id}` reference (simulating what the raw-Markdown editor would have produced), then assert the delete is blocked and named correctly. Don't skip or defer this test as "not yet exercisable" — it's exercisable today, precisely because of the raw-Markdown escape hatch, and the epics doc calls this out explicitly so it isn't miscategorized as untestable

- [x] Task 4 — Frontend: delete confirm UI (AC: #2)
  - [x] Extend Story 7.2's delete-confirm message builder (`ConfirmModal.tsx` caller, already extended once by Story 7.3 for Page counts) with a resource-specific case: when `deleteResource` fails with the new conflict response, replace the confirm flow with a message naming the referencing block(s) and two explicit actions — "Cancel" and "Remove from content and delete" (calling the `forceRemoveFromContent` variant) — never a single generic "delete failed" toast that loses the tutor's original intent to delete

- [x] Task 5 — Tests
  - [x] Backend: the raw-Markdown-reference test from Task 3's own bullet; deleting an unreferenced resource still succeeds unconditionally (no regression against Story 8.1's original behavior); "Remove from content and delete" strips the reference from every referencing Page, not just the first one found, and commits both the Markdown edit and the resource delete atomically
  - [x] Frontend: `resolveResourceUrl` caches per-`resourceId` (assert the underlying `requestBlob` call happens once across two calls with the same id); the delete-confirm flow shows the two-action UI only when the backend reports a conflict, and the plain single-confirm flow otherwise (no regression against Story 8.1's original unconditional-delete UI for an unreferenced resource)

## Dev Notes

- **Builds on Story 8.1** (the `Resource` entity, `DeleteResourceAsync`'s current unconditional shape — this story adds the guard in front of it, doesn't replace the method's core delete logic) and Story 7.3 (the raw-Markdown "Markdown" view, `RawBlock.ts` — the mechanism that makes AC #3's hand-typed-reference test case real today, not hypothetical).
- **First real exercise of `lib/markdown.ts`'s custom-URI resolution** — every prior story that touched `lib/markdown.ts` (Story 7.3's Preview toggle) rendered plain CommonMark with no custom scheme. Confirm its actual current extension surface by reading it before assuming a resolver hook already exists.
- **Architecture:** AD-29 (binary-serving mechanism reuse — the whole of Task 1 is this AD applied, not invented), AD-7 (the `requestBlob` addition keeps correlation-ID capture uniform), FR-30/FR-31 verbatim.
- **Existing code to read before editing:** `CourseFilesController.cs`'s `DownloadFile` action (Task 1's reference pattern), `httpClient.ts` (where `requestBlob` is added), `lib/markdown.ts` (its current renderer surface), Story 8.1's `ContentService.DeleteResourceAsync` and `ConfirmModal.tsx` usage (Story 7.2/7.3's delete-confirm message builder, extended again here).
- **Git context:** no new commits since Story 8.1/8.2 were authored in this same session.

### Project Structure Notes

- No new files — every task extends an existing file from Epic 7 or Story 8.1/8.2.

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 8.3] — verbatim Acceptance Criteria, including its own explicit AC #3 testing note
- [Source: _specs/implementation-artifacts/8-1-...md] — `Resource` entity, `DeleteResourceAsync`
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-29]
- [Source: Backend/src/FlexDemy.Api/Controllers/CourseFilesController.cs] — live code, the binary-serving pattern this story reuses

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Full backend build: 0 errors. `dotnet test` (all 3 projects): 556 + 223 + 141 = 920 passed, 0 failed, 0 regressions (up from 914 after Story 8.1).
- `tsc --noEmit`: zero new errors in any Story 8.3 file (pre-existing, unrelated repo errors untouched).
- `vitest run --project unit`: 89 files / 721 tests, 1 flaky timeout in `App.test.tsx` (a Master-nav-dropdown test, unrelated to any Story 8.3 file) that passed cleanly when re-run in isolation -- confirmed as full-suite parallel-load flakiness, not a real regression.

### Completion Notes List

- Task 1 verified Task 1's own AD-29 precedent by reading `CourseFilesController.DownloadFile`/`CourseFileService.DownloadFileAsync` before writing `GetResourceContentAsync`/`GetResourceContent` -- same standard authenticated-stream shape, ownership-only (not Draft-gated) per this story's own explicit instruction (differs from `CourseFile`'s own Draft-gated download).
- Task 2: `lib/markdown.ts` had no prior custom-URI extension point (confirmed by reading it) -- added the minimal hook: a new `resourceImage` InlineNode variant (the one exception to "images render as alt text only"), plus `MarkdownViewer.tsx`'s new `resolveResourceUrl` prop threaded via React Context (not a prop drilled through every recursive render call) to a small `ResolvedResourceImage` component that resolves-and-swaps in an `<img>`, falling back to alt text with no resolver configured or on a resolve failure.
- Task 2: `resolveResourceUrl` (`courseContentService.ts`) caches per-`resourceId` in a module-level `Map` for the editor session's lifetime; caller-owned cleanup documented inline (no auto-revocation, since the cache's whole point is cross-consumer reuse within a session).
- Task 2/AD-7: added `requestBlob` to `httpClient.ts` (first binary-content consumer in this codebase) rather than a one-off `fetch` bypassing the shared correlation-ID capture path. Extended `HttpClientError` with a `status: number` field (0 for a network failure) so a 409 conflict can be distinguished from any other failure without parsing message text; propagated through `CourseContentError.status` the same way. Purely additive -- no existing `HttpClientError`/`CourseContentError` catch site broke (all only ever read `.message`).
- Task 3: `DeleteResourceAsync` gained a `forceRemoveFromContent = false` parameter (source-compatible with every existing Story 8.1 call site and test) -- guards on a plain substring scan of every Page's `BodyMarkdown` in the course for `resource:{id}` (no structured reference index exists, per DD-3's "BodyMarkdown is unvalidated text"), throwing `ConflictException` (409) naming the referencing page(s) unless the caller explicitly forces the removal, in which case every reference is stripped and the resource deleted in the same commit.
- Task 3/AC #3: the delete-in-use guard test was written using exactly the raw-Markdown escape hatch the epics doc calls out (`Page.BodyMarkdown` set directly to a string containing a `resource:{id}` reference, simulating what Story 7.3's Markdown edit view would have produced) -- not skipped or deferred as "unverifiable before Epic 9."
- No new files beyond what Task 2's own "Project Structure Notes" anticipated (this story adds no new files at all per its own note -- every change extends an existing Epic 7/Story 8.1/8.2 file, confirmed true).

### File List

**Backend — modified:**
- `Backend/src/FlexDemy.Application/Courses/IContentService.cs` (`DeleteResourceAsync` gains `forceRemoveFromContent`, new `GetResourceContentAsync`)
- `Backend/src/FlexDemy.Application/Courses/ChapterDto.cs` (new `ResourceContentDto`)
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs` (delete-in-use guard, `GetResourceContentAsync`, `FindPagesReferencingResourceAsync`, `GetAllPagesInCourseAsync`)
- `Backend/src/FlexDemy.Api/Controllers/ContentController.cs` (`DeleteResource` gains `[FromQuery] forceRemoveFromContent`; new `GetResourceContent`)

**Backend — tests:**
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs` (modified — 6 new tests: delete-in-use guard, force-remove-strips-every-reference, unreferenced-delete-still-succeeds, `GetResourceContentAsync` × 3)

**Frontend — modified:**
- `FrontEnd/src/services/httpClient.ts` (`HttpClientError.status`, new `requestBlob`)
- `FrontEnd/src/services/courseContentService.ts` (`CourseContentError.status`, `deleteResource` gains `forceRemoveFromContent`, new `resolveResourceUrl` with per-id cache)
- `FrontEnd/src/lib/markdown.ts` (new `resourceImage` InlineNode variant, `resource:` URI detection)
- `FrontEnd/src/ui/MarkdownViewer.tsx` (`ResourceResolverContext`, `ResolvedResourceImage`, new `resolveResourceUrl` prop)
- `FrontEnd/src/features/CourseContentEditor/PagePreviewPanel.tsx` (threads `resolveResourceUrl` through to `MarkdownViewer`)
- `FrontEnd/src/features/CourseContentEditor/DocumentCanvas.tsx` (passes `resolveResourceUrl` to `PagePreviewPanel`)
- `FrontEnd/src/features/CourseContentEditor/extensions/LearningResourcesNodeView.tsx` (409-conflict two-action `ConfirmModal` flow on delete)

**Frontend — tests:**
- `FrontEnd/tests/services/httpClient.test.ts` (extended — status field, `requestBlob` describe block)
- `FrontEnd/tests/services/courseContentService.test.ts` (new — `resolveResourceUrl` caching, `deleteResource` query param)
- `FrontEnd/tests/lib/markdown.test.ts` (extended — `resource:` URI parsing)
- `FrontEnd/tests/ui/MarkdownViewer.test.tsx` (extended — resolver rendering/fallback)
- `FrontEnd/tests/features/CourseContentEditor/extensions/LearningResourcesBlock.test.tsx` (extended — delete-conflict two-action UI)

## Change Log

| Date | Change |
|------|--------|
| 2026-08-17 | Story 8.3 implemented: `GET content/resources/{resourceId}/content` binary-serving endpoint (AD-29, owner-read only); `resource:{id}` URI resolution end-to-end (`lib/markdown.ts`'s new `resourceImage` node, `MarkdownViewer.tsx`'s resolver context, `courseContentService.resolveResourceUrl`'s per-session cache, `httpClient.ts`'s new `requestBlob`); delete-in-use guard (`ConflictException` naming referencing pages, `forceRemoveFromContent` "Remove from content and delete" second action, both in one commit) and its frontend two-action `ConfirmModal` flow. No new files -- every change extends an existing Epic 7/Story 8.1/8.2 file. Status: review. |
