---
baseline_commit: 245d80348a8c8e55a2e4dbd2037bbd83385a56ce
---

# Story 11.3: Reviewer Access & Read-Path Authorization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a course reviewer (Admin acting in a review capacity),
I want to read a course's outline, pages, and resources while it's In Review,
So that I can actually review what the tutor submitted, not just what's Published.

## Acceptance Criteria

1. **Given** a course is `InReview` or `ReviewConfirmed` **When** an Admin (Master or Support) requests the outline, a chapter document, or a resource **Then** access is granted via the existing JWT + `FeatureAuthorizationHandler` policy pattern — no distinct "Reviewer" role exists in this codebase; reviewer access **is** Admin access (backend AD-29)
2. **Given** a course is `Draft` **When** anyone other than the owning tutor requests its content **Then** access remains denied exactly as it is today (`EnsureOwnedDraftAsync`)
3. Real-student read access to a genuinely `Published` course (as opposed to the tutor's own "Preview as student") requires an enrollment check that does not exist anywhere in the domain model yet — this story ships the reviewer/admin branch only; the student branch defaults to deny until an Enrollment primitive exists (backend AD-29, tracked in Deferred, not this epic's scope to design)

## Tasks / Subtasks

- [x] Task 1 — Backend: expose the caller's role to Application-layer services (AC: #1)
  - [x] **`ICurrentUserService` currently exposes only `UserId` — confirmed by reading the live interface.** Add a `UserRole? Role { get; }` member. `Infrastructure/Security/HttpContextCurrentUserService.cs`'s implementation reads `ClaimTypes.Role` off the current `HttpContext.User` (mirroring `FeatureAuthorizationHandler.cs`'s own identical claim lookup — `context.User.FindFirstValue(ClaimTypes.Role)` — reuse that exact claim name, don't introduce a second convention for reading the same claim), parsed via `Enum.TryParse<UserRole>`, returning `null` when absent or unparseable (matching this file's existing "return null rather than throw when there's no authenticated context" posture for `UserId`)
  - [x] This is a small, mechanical addition to an existing class — not a new authentication mechanism. No `FeatureAuthorizationHandler`/policy changes are needed for this task

- [x] Task 2 — Backend: a shared read-authorization helper implementing AD-29's owner/reviewer/(deferred-student) branches (AC: #1, #2, #3)
  - [x] New `ICourseService.EnsureReadableAsync(courseId)`: grants access when **any** of —
    - the caller is the course's owning tutor (any `LifecycleState`)
    - the caller's `Role` (Task 1) is `Master` or `Support` **and** `course.LifecycleState ∈ { InReview, ReviewConfirmed, Published }`
    - otherwise: throws `NotFoundException` (never `UnauthorizedAppException`) — implemented from scratch (not by reusing `EnsureOwnedAsync` internally), since that existing sibling method throws `UnauthorizedAppException` on a non-owner and this story's own AC requires `NotFoundException` in every non-granted case
  - [x] **The student branch is explicitly NOT built here** — no commented-out placeholder, no `TODO`; the absence of a branch is the correct deny-by-default behavior

- [x] Task 3 — Backend: retrofit `EnsureReadableAsync` into every ContentAuthoring read method built across Epics 7–11 so far (AC: #1, #2)
  - [x] Replaced every `courseService.EnsureOwnedAsync(courseId, ...)` call site in `ContentService.cs` with `courseService.EnsureReadableAsync(courseId, ...)` — 10 call sites found and retrofitted (see Completion Notes for the full list, one more than the story's own illustrative 5-name list, since `GetResourcesByOwnerAsync` is also a genuine content read the audit caught)
  - [x] Audit for completeness: grepped `ContentService.cs` for every `EnsureOwnedAsync`/`EnsureOwnedDraftAsync` call — confirmed 0 remaining `EnsureOwnedAsync` calls after the retrofit, and every remaining `EnsureOwnedDraftAsync` call site is a genuine mutation (create/update/delete/reorder/move), not a read
  - [x] Mutation methods (`EnsureOwnedDraftAsync`-gated) are **unchanged** — verified, none touched

- [x] Task 4 — Tests
  - [x] `EnsureReadableAsync` unit tests (`CourseServiceTests.cs`): owning tutor reads succeed at every `LifecycleState`; a Master/Support caller succeeds at `InReview`/`ReviewConfirmed`/`Published` and is rejected (as `NotFoundException`) at `Draft`; a non-owning, non-Admin caller (`Student`/`Tutor` role) is rejected at every state including `Published`; also covers the genuinely-unknown-course-id and unauthenticated-caller edge cases
  - [x] Integration-style tests (`ContentServiceTests.cs`, service-layer, no `WebApplicationFactory` — matches this epic's existing convention) confirming each retrofitted read method now actually rejects a Draft-course non-owner and accepts a Master/Support-role caller on an `InReview` course — one test per method, wiring a REAL `CourseService` (not a mock) as `ContentService`'s `ICourseService` dependency so the retrofit's actual wiring is exercised end-to-end, not just re-asserted against a mock

## Dev Notes

- **This story's real risk is an incomplete retrofit (Task 3), not the authorization logic itself (Task 2), which is straightforward.** Every prior Epic 7–11 story that added a read method was told, individually, to use "ownership-only, not Draft-gated" — accurate at the time (no reviewer/Admin concept existed yet in any of those stories' scope), but it means there are now five-plus independent call sites this story must find and update, not one. Treat the audit sub-bullet in Task 3 as load-bearing, not optional.
- **`ICurrentUserService.Role` is a small, genuinely new capability** — no prior story needed the caller's role in the Application layer (only `UserId`, for ownership checks). Confirm no other code accidentally already reads `ClaimTypes.Role` via a different, inconsistent path before adding this — `FeatureAuthorizationHandler.cs` is the only known existing reader, in the Api layer, for a different purpose (policy gating, not data-dependent read authorization).
- **Architecture:** AD-29 in its primary implementation story for the reviewer branch specifically (the student branch is explicitly Deferred, per that AD's own text and this story's AC #3).
- **Existing code to read before editing:** `ICurrentUserService.cs`/`HttpContextCurrentUserService.cs` (Task 1's exact extension point), `FeatureAuthorizationHandler.cs` (the claim-reading precedent to mirror, and the reason this story doesn't need to touch it), `ICourseService.cs`'s `EnsureOwnedAsync`/`EnsureOwnedDraftAsync` (Task 2's siblings), `CourseService.GetCourseByIdAsync` (the existing "don't leak existence, throw NotFoundException" precedent), and every `ContentService.cs` read method from Stories 7.1/7.2/7.4/8.3/11.2 (Task 3's retrofit targets — read all of them, this story cannot be done accurately from memory of what those stories said, the actual landed code is the source of truth).
- **Git context:** no new commits since Story 11.2 was authored in this same session.

### Project Structure Notes

- No new files — this story extends `ICurrentUserService.cs`, `HttpContextCurrentUserService.cs`, `ICourseService.cs`/`CourseService.cs`, and `ContentService.cs` (the retrofit).

### References

- [Source: _specs/planning-artifacts/epics-ContentAuthoring.md#Story 11.3] — verbatim Acceptance Criteria
- [Source: _specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md#AD-29] — the full owner/reviewer/student branch definition, including the corrected 2026-08-17 scope (all three read routes, not resources alone)
- [Source: Backend/src/FlexDemy.Application/Common/ICurrentUserService.cs, Backend/src/FlexDemy.Infrastructure/Security/HttpContextCurrentUserService.cs, Backend/src/FlexDemy.Api/Authorization/FeatureAuthorizationHandler.cs] — live code read in full during this story's own creation
- [Source: _specs/implementation-artifacts/7-1-...md, 7-2-...md, 7-4-...md, 8-3-...md, 11-2-...md] — every prior read method this story retrofits

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **`EnsureReadableAsync` built from scratch, not by delegating to `EnsureOwnedAsync`** — that existing sibling method throws `UnauthorizedAppException` on a non-owner (its own established contract, used by Story 3.5's drill-down override setter), which conflicts with this story's own AC #1's explicit "throws NotFoundException, never UnauthorizedAppException." Deliberately does not call `RequireCurrentUserId()` either, for the same reason (it throws `UnauthorizedAppException` for an unauthenticated caller) — an unauthenticated caller simply falls through every branch to the final `NotFoundException`, tested explicitly.
- **The full retrofit — 10 call sites in `ContentService.cs`, one more than the story's own illustrative list of 5 named methods**: `GetChapterListAsync`, `GetChapterDocumentAsync`, `GetChapterDeleteImpactAsync`, `GetTopicDeleteImpactAsync`, `GetSubtopicDeleteImpactAsync`, `GetPageAsync`, `GetPageDeleteImpactAsync`, `GetResourcesByOwnerAsync`, `GetResourceContentAsync`, `GetOutlineAsync`. The audit (grepping for every `EnsureOwnedAsync`/`EnsureOwnedDraftAsync` call) is what surfaced `GetResourcesByOwnerAsync` — a genuine content read (Story 8.1/8.2's resource-list endpoint) not explicitly named in the story text but caught by the "every method that reads" instruction.
- **Deliberately out of scope, flagged not silently fixed**: `CourseFileService.cs`'s `GetFilesAsync`/`DownloadFileAsync` currently use `EnsureOwnedDraftAsync` (Draft-gated) for what are genuinely reads — meaning today, a tutor can't even view their own uploaded files once their course leaves Draft (e.g. once InReview). This is a real, pre-existing gap adjacent to this story's own concern, but it's about the *owner's* own access being wrongly Draft-gated, not about reviewer access — and it lives in `CourseFileService.cs`, which this story's own Task 3 scope explicitly limits to `ContentService.cs`. Not touched here; worth a future story or retrospective action item.
- **Integration-style tests wire a REAL `CourseService`** (via a small `MakeRetrofitSut` helper in `ContentServiceTests.cs`), not a mock, as `ContentService`'s `ICourseService` dependency — this is what makes the retrofit tests genuinely prove the wiring works end-to-end (a missed call site would show up as a test failure), not just re-assert `EnsureReadableAsync`'s own branch logic a second time through a mock.
- All 963 backend tests pass (588 Application + 234 Infrastructure + 141 Api) with zero regressions. No frontend files were touched by this story (purely backend, per its own scope).

### File List

- `Backend/src/FlexDemy.Application/Common/ICurrentUserService.cs` — MODIFIED: added `Role`
- `Backend/src/FlexDemy.Infrastructure/Security/HttpContextCurrentUserService.cs` — MODIFIED: implemented `Role`
- `Backend/src/FlexDemy.Application/Courses/ICourseService.cs` — MODIFIED: added `EnsureReadableAsync`
- `Backend/src/FlexDemy.Application/Courses/CourseService.cs` — MODIFIED: implemented `EnsureReadableAsync`
- `Backend/src/FlexDemy.Application/Courses/ContentService.cs` — MODIFIED: all 10 read methods retrofitted to call `EnsureReadableAsync`
- `Backend/tests/FlexDemy.Application.Tests/Courses/CourseServiceTests.cs` — MODIFIED: new `EnsureReadableAsync` unit tests
- `Backend/tests/FlexDemy.Application.Tests/Courses/ContentServiceTests.cs` — MODIFIED: updated existing tests to reference `EnsureReadableAsync`; new `MakeRetrofitSut` helper and 5 integration-style retrofit tests

### Change Log

- 2026-08-18: Story 11.3 implemented — `ICurrentUserService.Role` (Task 1), `EnsureReadableAsync` (Task 2), full `ContentService.cs` read-path retrofit (Task 3), tests (Task 4). Status: review.
