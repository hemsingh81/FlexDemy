using System.Text.Json;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

// The Chapter/Topic/Subtopic tree and its cached Drill-Down/Ways adaptive content were removed --
// a snapshot now archives each of the course's uploaded files' raw parsed text instead. Same
// restore-by-id mechanism as before (files not present in the snapshot are simply left alone;
// there is no "delete then re-add" step here since, unlike the old tree, a course's own set of
// CourseFile rows was never something a version replaces wholesale -- restoring just writes each
// snapshotted file's text back onto its still-existing row, matched by id).
public class VersionService(
    ICourseFileRepository courseFileRepository,
    IVersionRepository repository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork) : IVersionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task CreateSnapshotAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var files = await courseFileRepository.GetByCourseIdAsync(courseId, cancellationToken);
        var snapshotFiles = files.Select(f => new SnapshotFile(f.Id, f.FileName, f.ParsedContent)).ToList();
        var snapshotJson = JsonSerializer.Serialize(new SnapshotContent(snapshotFiles), JsonOptions);

        repository.Add(new CourseVersion
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            SnapshotJson = snapshotJson,
            PublishedAt = DateTimeOffset.UtcNow,
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Tutor-facing version history, newest first (IVersionRepository's own GetAllByCourseIdAsync
    // already orders this way).
    public async Task<IReadOnlyList<CourseVersionDto>> GetVersionsAsync(string courseId, CancellationToken cancellationToken = default)
    {
        // Tutor-owned-course only -- without this, any authenticated tutor could read another
        // tutor's course's version history by guessing/enumerating a courseId.
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);

        var versions = await repository.GetAllByCourseIdAsync(courseId, cancellationToken);
        return versions.Select(ToVersionDto).ToList();
    }

    // AD-17's own literal text -- "restoring a prior version swaps an active-version pointer to
    // that snapshot, not a diff/replay engine." Writes each snapshotted file's text back onto the
    // still-existing CourseFile row with that id; a file added since the snapshot is left alone, a
    // file the snapshot recorded but that's since been deleted is simply skipped (nothing to
    // restore it onto -- same orphaned-snapshot-entry tolerance the old tree-based restore had for
    // adaptive content rows with no live parent).
    public async Task RestoreVersionAsync(string courseId, string versionId, CancellationToken cancellationToken = default)
    {
        // Tutor-owned-course only -- without this, any authenticated tutor could overwrite
        // another tutor's course content by guessing/enumerating a courseId + versionId.
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);

        var version = await repository.GetByIdAsync(versionId, cancellationToken)
            ?? throw new NotFoundException(nameof(CourseVersion), versionId);
        // Scoped to courseId so a version id belonging to a different course is never restorable
        // through this course's own ownership boundary.
        if (version.CourseId != courseId)
            throw new NotFoundException(nameof(CourseVersion), versionId);

        var snapshot = JsonSerializer.Deserialize<SnapshotContent>(version.SnapshotJson, JsonOptions)
            ?? throw new InvalidOperationException($"CourseVersion '{versionId}' has an unreadable snapshot.");

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var currentFiles = await courseFileRepository.GetByCourseIdAsync(courseId, cancellationToken);
            var currentFilesById = currentFiles.ToDictionary(f => f.Id);

            foreach (var snapshotFile in snapshot.Files)
            {
                if (currentFilesById.TryGetValue(snapshotFile.Id, out var file))
                    file.ParsedContent = snapshotFile.ParsedContent;
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);

            // ICourseService owns Course entity mutation (AD-12) -- its own internal
            // SaveChangesAsync enlists in this same ambient transaction.
            await courseService.MarkDraftAsync(courseId, cancellationToken);
        }, cancellationToken);
    }

    private static CourseVersionDto ToVersionDto(CourseVersion version)
    {
        var snapshot = JsonSerializer.Deserialize<SnapshotContent>(version.SnapshotJson, JsonOptions)!;
        return new CourseVersionDto(version.Id, version.PublishedAt, snapshot.Files.Count);
    }

    private sealed record SnapshotContent(IReadOnlyList<SnapshotFile> Files);
    private sealed record SnapshotFile(string Id, string FileName, string? ParsedContent);
}
