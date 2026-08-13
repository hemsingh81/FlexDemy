using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.8/Task 4: kept narrow (Add only) in that story -- Story 3.10 adds the Get/List methods
// here now, for restore/version-history.
public interface IVersionRepository
{
    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void Add(CourseVersion version);

    Task<CourseVersion?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    // Newest first -- backs the tutor-facing version-history list.
    Task<List<CourseVersion>> GetAllByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
}
