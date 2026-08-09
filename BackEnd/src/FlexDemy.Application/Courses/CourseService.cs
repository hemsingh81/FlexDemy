using FlexDemy.Application.Common;

namespace FlexDemy.Application.Courses;

public class CourseService(ICourseRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : ICourseService
{
    public async Task<IReadOnlyList<CourseDto>> GetCoursesAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default)
    {
        var courses = await repository.GetAllAsync(gradeTag, search, subject, cancellationToken);
        return courses.Select(c => c.ToDto()).ToList();
    }

    public async Task<CourseDto> GetCourseByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var course = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.Course), id);
        return course.ToDto();
    }

    public async Task<CourseDto> CreateCourseAsync(CreateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var course = request.ToEntity(idGenerator.NewId(), DateTimeOffset.UtcNow);
        repository.Add(course);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }
}
