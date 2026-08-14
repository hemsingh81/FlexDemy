namespace FlexDemy.Application.AdaptiveLearning;

public interface IVersionService
{
    // Called from PublishService.PublishAsync, immediately before the course transitions to
    // Published.
    Task CreateSnapshotAsync(string courseId, CancellationToken cancellationToken = default);

    // Tutor-facing version history, newest first.
    Task<IReadOnlyList<CourseVersionDto>> GetVersionsAsync(string courseId, CancellationToken cancellationToken = default);

    // AD-17's "swap an active-version pointer" capability -- writes the chosen snapshot's file
    // text back onto the course's current CourseFile rows, and lands the course in Draft (restored
    // content needs fresh review, FR-15). Distinct from ICourseService.ReturnToDraftAsync, which
    // never touches content.
    Task RestoreVersionAsync(string courseId, string versionId, CancellationToken cancellationToken = default);
}

// Kept minimal -- just enough to distinguish entries in a version-history list. FileCount is
// derived from SnapshotJson at read time (not a stored column), matching this codebase's general
// "don't store what's cheap to derive" posture.
public sealed record CourseVersionDto(string Id, DateTimeOffset PublishedAt, int FileCount);
