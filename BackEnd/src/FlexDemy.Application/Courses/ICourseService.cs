namespace FlexDemy.Application.Courses;

// AD-3: plain service interface, no mediator. AD-12: other features may depend on this
// interface to reuse Courses' business rules, but never on ICourseRepository directly.
public interface ICourseService
{
    Task<IReadOnlyList<CourseDto>> GetCoursesAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default);
    Task<CourseDto> GetCourseByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<CourseDto> CreateCourseAsync(CreateCourseRequest request, CancellationToken cancellationToken = default);
}
