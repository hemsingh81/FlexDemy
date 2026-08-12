namespace FlexDemy.Application.Courses;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record CourseDto(
    string Id,
    string Title,
    string ShortDescription,
    string FullDescription,
    string Subject,
    string Level,
    string TargetGradeTag,
    IReadOnlyList<string> Tags,
    string InstructorName,
    string? InstructorRole,
    string? InstructorAvatar,
    decimal Rating,
    int EnrolledCount,
    int EstimatedHours,
    string? ThumbnailUrl,
    string? BadgeIcon,
    string LifecycleState,
    IReadOnlyList<CourseThumbnailDto> Thumbnails,
    IReadOnlyList<string> TagIds,
    string? CountryId,
    string? StateId,
    string? CityId,
    string? BoardId,
    string? ClassLevelId,
    string? SubjectId
);

public record CreateCourseRequest(
    string Title,
    string ShortDescription,
    string FullDescription,
    string Subject,
    string Level,
    string TargetGradeTag,
    IReadOnlyList<string>? Tags,
    string InstructorName,
    string? InstructorRole,
    string? InstructorAvatar,
    int EstimatedHours,
    string? ThumbnailUrl,
    string? BadgeIcon
);

// Story 2.4 -- the wizard's Draft-scoped shapes, deliberately separate from CreateCourseRequest
// above (which requires Subject/Level/TargetGradeTag/InstructorName a fresh Draft doesn't have
// yet; see Course.cs's Dev Notes on why those fields were relaxed from `required`).
public record CreateDraftCourseRequest(string Title, string Description);

// Story 2.5: TagIds/taxonomy fields are here, not on CreateDraftCourseRequest -- Step 1 (where a
// Draft is first created) only ever collects Title/Description; Tags/Taxonomy are steps 2/3,
// always reached after the Draft already exists, so they only ever arrive via an update.
public record UpdateDraftCourseRequest(
    string Title,
    string Description,
    IReadOnlyList<string>? TagIds = null,
    string? CountryId = null,
    string? StateId = null,
    string? CityId = null,
    string? BoardId = null,
    string? ClassLevelId = null,
    string? SubjectId = null
);

public record ThumbnailCropDto(decimal X, decimal Y, decimal Zoom);

public record CourseThumbnailDto(string Id, string Url, bool IsPrimary, int Order, ThumbnailCropDto Crop);
