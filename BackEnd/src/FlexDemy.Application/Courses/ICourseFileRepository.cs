using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICourseFileRepository
{
    Task<CourseFile?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourseFile>> GetByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
    void Add(CourseFile file);

    // Story 2.9/Task 6: successfully-extracted files this course's tree hasn't materialized yet.
    Task<IReadOnlyList<CourseFile>> GetPendingMaterializationAsync(string courseId, CancellationToken cancellationToken = default);

    // Atomic conditional claim (AiTaskBudgetRepository.TryReserveAsync's own established pattern) --
    // returns true only for the caller whose UPDATE actually flipped IsMaterialized false->true;
    // a concurrent second caller racing on the same fileId gets false and must not materialize it
    // again. Raw SQL, not translatable by EF Core's InMemory provider (BackEnd/CLAUDE.md's Testing
    // section already documents this gap for TryReserveAsync -- same category here).
    Task<bool> TryClaimForMaterializationAsync(string fileId, CancellationToken cancellationToken = default);
}
