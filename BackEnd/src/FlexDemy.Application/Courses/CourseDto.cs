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
    string? BadgeIcon
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
