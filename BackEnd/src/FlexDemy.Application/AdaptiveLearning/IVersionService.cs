namespace FlexDemy.Application.AdaptiveLearning;

public interface IVersionService
{
    // Called only from the publish-batch-completion finalize step (Story 3.8/Task 3).
    Task CreateSnapshotAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.10/Task 3: tutor-facing version history, newest first.
    Task<IReadOnlyList<CourseVersionDto>> GetVersionsAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 3.10/Task 3: AD-17's "swap an active-version pointer" capability -- replaces the
    // course's CURRENT Chapter/Topic/Subtopic/ContentBlock rows with a deep-copy reconstruction of
    // the chosen version's snapshot, and lands the course in Draft (restored content needs fresh
    // review, FR-15). Distinct from ICourseService.ReturnToDraftAsync, which never touches content.
    Task RestoreVersionAsync(string courseId, string versionId, CancellationToken cancellationToken = default);
}

// Kept minimal -- just enough to distinguish entries in a version-history list. ChapterCount/
// TopicCount are derived from SnapshotJson at read time (not stored columns), matching this
// codebase's general "don't store what's cheap to derive" posture.
public sealed record CourseVersionDto(string Id, DateTimeOffset PublishedAt, int ChapterCount, int TopicCount);
