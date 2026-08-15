using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICourseRepository
{
    // Code-review patch: the public course catalog previously had no paging at all -- an
    // unbounded query let the whole Published-course table be read in one request. Same
    // (Items, TotalCount) paged shape ErrorRecordRepository.QueryAsync/AiTaskUsageRepository's
    // own established convention already uses elsewhere in this codebase.
    Task<(IReadOnlyList<Course> Items, int TotalCount)> GetAllAsync(string? gradeTag, string? search, string? subject, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<Course?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    // Story 2.4: unlike GetByIdAsync (unfiltered, used by the public catalog's detail view),
    // this is what the Draft-mutating service methods use -- includes Thumbnails, and
    // deliberately does not filter by LifecycleState (a tutor must be able to fetch and keep
    // editing their own Draft).
    Task<Course?> GetDraftByIdAsync(string id, CancellationToken cancellationToken = default);
    // FR-31 (CourseWizard PRD S4.11): every course a tutor owns, any Lifecycle State -- backs
    // the "resume a course" list, deliberately unfiltered by state unlike GetAllAsync (which is
    // Published-only) so a Draft is just as reachable here as a Published course.
    Task<IReadOnlyList<Course>> GetByTutorIdAsync(string tutorId, CancellationToken cancellationToken = default);
    void Add(Course course);
}
