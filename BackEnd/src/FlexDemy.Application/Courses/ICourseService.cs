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
}
