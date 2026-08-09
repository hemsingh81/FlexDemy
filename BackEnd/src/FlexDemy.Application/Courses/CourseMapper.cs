using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class CourseMapper
{
    public static CourseDto ToDto(this Course course) => new(
        course.Id,
        course.Title,
        course.ShortDescription,
        course.FullDescription,
        course.Subject,
        course.Level,
        course.TargetGradeTag,
        course.Tags,
        course.InstructorName,
        course.InstructorRole,
        course.InstructorAvatar,
        course.Rating,
        course.EnrolledCount,
        course.EstimatedHours,
        course.ThumbnailUrl,
        course.BadgeIcon
    );

    public static Course ToEntity(this CreateCourseRequest request, string id, DateTimeOffset createdAt) => new()
    {
        Id = id,
        Title = request.Title,
        ShortDescription = request.ShortDescription,
        FullDescription = request.FullDescription,
        Subject = request.Subject,
        Level = request.Level,
        TargetGradeTag = request.TargetGradeTag,
        Tags = request.Tags?.ToList() ?? [],
        InstructorName = request.InstructorName,
        InstructorRole = request.InstructorRole,
        InstructorAvatar = request.InstructorAvatar,
        EstimatedHours = request.EstimatedHours,
        ThumbnailUrl = request.ThumbnailUrl,
        BadgeIcon = request.BadgeIcon,
        CreatedAt = createdAt,
    };
}
