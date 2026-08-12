using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICourseRepository
{
    Task<IReadOnlyList<Course>> GetAllAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default);
    Task<Course?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    // Story 2.4: unlike GetByIdAsync (unfiltered, used by the public catalog's detail view),
    // this is what the Draft-mutating service methods use -- includes Thumbnails, and
    // deliberately does not filter by LifecycleState (a tutor must be able to fetch and keep
    // editing their own Draft).
    Task<Course?> GetDraftByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(Course course);
}
