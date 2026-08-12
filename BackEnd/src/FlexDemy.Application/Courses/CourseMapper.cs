using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class CourseMapper
{
    public static CourseDto ToDto(this Course course)
    {
        var orderedThumbnails = course.Thumbnails.OrderBy(t => t.Order).Select(t => t.ToDto()).ToList();
        // Story 2.4/AC#5: keeps every existing CourseDto.ThumbnailUrl consumer working
        // unchanged -- derived from the primary Thumbnails entry when one exists, else falls
        // back to the entity's own legacy single-URL value.
        var derivedThumbnailUrl = orderedThumbnails.FirstOrDefault(t => t.IsPrimary)?.Url
            ?? orderedThumbnails.FirstOrDefault()?.Url
            ?? course.ThumbnailUrl;

        return new CourseDto(
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
            derivedThumbnailUrl,
            course.BadgeIcon,
            course.LifecycleState.ToString(),
            orderedThumbnails,
            course.TagIds,
            course.CountryId,
            course.StateId,
            course.CityId,
            course.BoardId,
            course.ClassLevelId,
            course.SubjectId
        );
    }

    public static CourseThumbnailDto ToDto(this CourseThumbnail thumbnail) => new(
        thumbnail.Id,
        thumbnail.Url,
        thumbnail.IsPrimary,
        thumbnail.Order,
        new ThumbnailCropDto(thumbnail.CropX, thumbnail.CropY, thumbnail.CropZoom)
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static Course ToEntity(this CreateCourseRequest request, string id) => new()
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
    };
}
