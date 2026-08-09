using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICourseRepository
{
    Task<IReadOnlyList<Course>> GetAllAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default);
    Task<Course?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(Course course);
}
