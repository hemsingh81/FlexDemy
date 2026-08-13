namespace FlexDemy.Application.Courses;

// AD-3: plain service interface, no mediator. AD-12: other features may depend on this
// interface to reuse Courses' business rules, but never on ICourseRepository directly.
public interface ICourseService
{
    Task<IReadOnlyList<CourseDto>> GetCoursesAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default);
    Task<CourseDto> GetCourseByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<CourseDto> CreateCourseAsync(CreateCourseRequest request, CancellationToken cancellationToken = default);

    // Story 2.4: the wizard's live-wire persistence surface.
    Task<CourseDto> CreateDraftCourseAsync(CreateDraftCourseRequest request, CancellationToken cancellationToken = default);
    Task<CourseDto> UpdateDraftCourseAsync(string id, UpdateDraftCourseRequest request, CancellationToken cancellationToken = default);
    // Returns the full updated CourseDto (not just the affected thumbnail) -- simplest,
    // least-racy contract for the frontend to replace its whole thumbnails array from the
    // response rather than hand-patching one entry, matching all 4 thumbnail mutators below.
    Task<CourseDto> AddThumbnailAsync(string courseId, Stream content, string contentType, long contentLength, ThumbnailCropDto crop, CancellationToken cancellationToken = default);
    Task<CourseDto> RemoveThumbnailAsync(string courseId, string thumbnailId, CancellationToken cancellationToken = default);
    Task<CourseDto> ReorderThumbnailAsync(string courseId, string thumbnailId, string direction, CancellationToken cancellationToken = default);
    Task<CourseDto> SetPrimaryThumbnailAsync(string courseId, string thumbnailId, CancellationToken cancellationToken = default);

    // Story 2.6/AD-12: a thin public wrapper around the same ownership+Draft-state guard every
    // thumbnail mutator above already uses, so CourseFileService can reuse it without depending
    // on ICourseRepository directly. Discards the loaded Course -- callers that need the entity
    // itself keep using their own repository; this is purely a "may I?" check.
    Task EnsureOwnedDraftAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 2.8/Task 3: an ownership-check-free system lookup for a Hangfire job (which has no
    // ICurrentUserService identity to check against -- the job itself is the trusted caller, not
    // an end user request). Unlike GetCourseByIdAsync, this never rejects a non-Published Draft
    // course for lacking a matching caller identity; it only throws NotFoundException if the id
    // genuinely doesn't exist (or, defensively, if the course has no TutorId at all -- shouldn't
    // happen for a wizard-created Draft, which always sets one, but this method's contract is a
    // non-nullable tutor id, not a second null case for callers to handle).
    Task<string> GetOwningTutorIdAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.5/Task 3: an ownership-only guard, deliberately NOT EnsureOwnedDraftAsync -- a
    // tutor sets Drill-Down/Ways overrides on a course that may already be Published, not only
    // while it's a Draft. Checks "is this caller this course's owning tutor" without additionally
    // requiring LifecycleState == Draft (EnsureOwnedDraftAsync's own extra constraint, which
    // doesn't apply here). Throws NotFoundException if the course doesn't exist or the caller
    // isn't its owner (same "don't leak existence to a non-owner" shape as GetCourseByIdAsync).
    Task EnsureOwnedAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.9/Task 1: the real Draft -> InReview -> ReviewConfirmed transitions Story 3.4's mock
    // hook simulated. MoveToReviewAsync requires LifecycleState == Draft and every node in the
    // content tree (all 4 entity types -- Chapter/Topic/Subtopic/ContentBlock, per FR-15's
    // broader confirmation scope, deliberately wider than Stories 3.5-3.8's Topic/Subtopic-only
    // generation-target scope) Confirmed; throws ValidationException naming the first unconfirmed
    // node found. ConfirmReviewAsync requires LifecycleState == InReview.
    Task MoveToReviewAsync(string courseId, CancellationToken cancellationToken = default);
    Task ConfirmReviewAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.10/Task 2: Published -> Draft, a state transition only -- content-tree rows are
    // left untouched (not a rollback; see IVersionService.RestoreVersionAsync for that). Re-publish
    // afterward requires the full MoveToReviewAsync -> ConfirmReviewAsync -> PublishAsync sequence
    // again, with no special-cased bypass.
    Task ReturnToDraftAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.10/Task 3: called only from IVersionService.RestoreVersionAsync (a system/trusted-
    // caller shape, mirroring MarkPublishedAsync below) -- restoring a prior version's content
    // always demands fresh review (FR-15) regardless of the course's CURRENT LifecycleState, so
    // unlike ReturnToDraftAsync (which specifically requires Published), this has no precondition
    // of its own: a restore from Draft, InReview, ReviewConfirmed, or Published all land in Draft.
    Task MarkDraftAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.8/Task 3: called only from PublishNodeContentJob's own batch-completion finalize
    // step (a system/Hangfire caller, not an end-user HTTP request) -- no ownership/precondition
    // check, mirroring GetOwningTutorIdAsync's own "the job itself is the trusted caller" shape.
    // The tutor-facing ReviewConfirmed -> Publishing trigger lives on IPublishService instead
    // (Application/AdaptiveLearning) -- AD-12: that trigger's own orchestration needs to write
    // PublishBatch/PublishBatchItem rows (native AdaptiveLearning-feature writes), so it can't
    // live on ICourseService without ICourseService reaching into another feature's repository.
    // This method only performs the terminal Publishing -> Published flip once the batch has
    // actually finished -- the one piece that genuinely must live here, since only Courses' own
    // service may mutate a Course entity.
    Task MarkPublishedAsync(string courseId, CancellationToken cancellationToken = default);
}
