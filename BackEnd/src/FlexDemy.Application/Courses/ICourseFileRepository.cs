using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICourseFileRepository
{
    Task<CourseFile?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourseFile>> GetByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
    void Add(CourseFile file);
    void Remove(CourseFile file);
}
