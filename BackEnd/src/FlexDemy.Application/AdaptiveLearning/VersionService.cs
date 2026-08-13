using System.Text.Json;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.8/Task 4: depends on IContentTreeRepository (reused, not a parallel reader) and
// IAdaptiveLearningRepository -- both already exist in this same Application/AdaptiveLearning
// feature area (Story 3.5), so this reads generated/override content directly via plain
// repository reads rather than IAdaptiveLearningService.GetOrGenerate*Async, which would trigger
// a fresh generation for any node whose pre-generation is still pending -- wrong for a snapshot,
// which archives whatever already exists at publish-completion time (every confirmed node's
// content is expected to already exist by the time this runs, since Task 2's job generates it
// before Task 3's finalize step calls this).
public class VersionService(
    IContentTreeRepository contentTreeRepository,
    IAdaptiveLearningRepository adaptiveLearningRepository,
    IVersionRepository repository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork) : IVersionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task CreateSnapshotAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var chapters = await contentTreeRepository.GetTreeAsync(courseId, cancellationToken);
        var adaptiveContent = new List<SnapshotNodeContent>();

        foreach (var chapter in chapters)
        {
            foreach (var topic in chapter.Topics)
            {
                adaptiveContent.Add(await CollectNodeContentAsync(topicId: topic.Id, subtopicId: null, cancellationToken));
                foreach (var subtopic in topic.Subtopics)
                    adaptiveContent.Add(await CollectNodeContentAsync(topicId: null, subtopicId: subtopic.Id, cancellationToken));
            }
        }

        var snapshotJson = JsonSerializer.Serialize(new SnapshotContent(chapters, adaptiveContent), JsonOptions);

        repository.Add(new CourseVersion
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            SnapshotJson = snapshotJson,
            PublishedAt = DateTimeOffset.UtcNow,
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Story 3.10/Task 3: tutor-facing version history, newest first (IVersionRepository's own
    // GetAllByCourseIdAsync already orders this way).
    public async Task<IReadOnlyList<CourseVersionDto>> GetVersionsAsync(string courseId, CancellationToken cancellationToken = default)
    {
        // Tutor-owned-course only -- without this, any authenticated tutor could read another
        // tutor's course's version history by guessing/enumerating a courseId.
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);

        var versions = await repository.GetAllByCourseIdAsync(courseId, cancellationToken);
        return versions.Select(ToVersionDto).ToList();
    }

    // Story 3.10/Task 3: AD-17's own literal text -- "restoring a prior version swaps an
    // active-version pointer to that snapshot, not a diff/replay engine." Deliberately reuses the
    // snapshot's ORIGINAL Chapter/Topic/Subtopic/ContentBlock ids (deserialized straight off the
    // real domain entity types CreateSnapshotAsync serialized, not a DTO) rather than minting new
    // ones: since a node's cached DrilldownLevel/WayContent/Exercise/KeywordDefinition rows are
    // keyed by that SAME TopicId/SubtopicId and were never deleted by the tree edits that moved
    // the course away from this version, reusing the original ids "reconnects" that already-cached
    // AI content for free the moment the tree is restored -- matching AC#1's "cached Drill-Down/
    // Way content" as something this system's versioning is meant to preserve, not just the tree
    // skeleton. This is safe because the current tree is deleted first (below): no live row can
    // still hold one of the snapshot's ids by the time the snapshot's chapters are re-inserted.
    public async Task RestoreVersionAsync(string courseId, string versionId, CancellationToken cancellationToken = default)
    {
        // Tutor-owned-course only -- without this, any authenticated tutor could overwrite
        // another tutor's course content by guessing/enumerating a courseId + versionId.
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);

        var version = await repository.GetByIdAsync(versionId, cancellationToken)
            ?? throw new NotFoundException(nameof(CourseVersion), versionId);
        // Scoped to courseId so a version id belonging to a different course is never restorable
        // through this course's own ownership boundary -- same "don't leak existence across
        // courses" posture IContentTreeRepository.FindNodeAsync's own doc comment establishes.
        if (version.CourseId != courseId)
            throw new NotFoundException(nameof(CourseVersion), versionId);

        var snapshot = JsonSerializer.Deserialize<SnapshotContent>(version.SnapshotJson, JsonOptions)
            ?? throw new InvalidOperationException($"CourseVersion '{versionId}' has an unreadable snapshot.");

        // Code-review patch: everything below runs inside one DB transaction, so a failure
        // between committing the new tree and committing MarkDraftAsync's LifecycleState change
        // can't leave a Published course's public catalog page (GetCoursesAsync, Published-only)
        // silently serving swapped-in content that never went through FR-15's required re-review
        // -- worse than this codebase's existing multi-commit precedent (PublishService's
        // zero-node finalize path, where a partial failure leaves at most an orphaned extra
        // CourseVersion row). IUnitOfWork/the underlying DbContext is Scoped (one instance per
        // request), so VersionService's own unitOfWork and CourseService's own unitOfWork (called
        // from inside the transaction via MarkDraftAsync) are the same instance and correctly
        // share this transaction.
        //
        // Removing the current chapters and adding the snapshot's (reusing its original node ids,
        // per this method's own doc comment above) in the SAME SaveChangesAsync call was verified
        // NOT to hit an EF Core identity-map collision -- confirmed directly against a real
        // DbContext, including with nested Topics (ContentTreeRepositoryTests.cs's own
        // RemoveChapter_then_AddChapter_reusing_the_same_id... tests): a Deleted entry and a
        // separate Added instance for the same key coexist and commit correctly as DELETE-then-
        // INSERT within one SaveChanges call, so this does not need to be split into two.
        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // Cascade-deletes every descendant Topic/Subtopic/ContentBlock (all four FKs are
            // DeleteBehavior.Cascade) -- ContentTreeService.DeleteNodeAsync's own established
            // precedent for removing a Chapter is to stage only the Chapter itself, never its
            // children.
            var currentChapters = await contentTreeRepository.GetTreeAsync(courseId, cancellationToken);
            foreach (var chapter in currentChapters)
                contentTreeRepository.RemoveChapter(chapter);

            // AddChapter stages db.Chapters.Add(chapter) -- EF Core's change tracker walks the
            // whole reachable navigation graph (Topics -> Subtopics/ContentBlocks) from one root
            // Add call, so no separate AddTopic/AddSubtopic/AddContentBlock call is needed per
            // descendant.
            foreach (var chapter in snapshot.Chapters)
                contentTreeRepository.AddChapter(chapter);

            // DrilldownLevel/WayContent rows have no FK to Topic/Subtopic (a plain string column,
            // confirmed via DrilldownLevelConfiguration.cs/WayContentConfiguration.cs) -- reusing
            // the snapshot's node ids above only "reconnects" whatever content CURRENTLY exists
            // for that id, which is the newer content if a tutor regenerated/overrode it after
            // this version was published, not what this specific version actually archived. AD-17's
            // own text ("swaps an active-version pointer to THAT snapshot") means the archived
            // adaptive content itself must be restored too, not just the tree structure -- so
            // every Level/Way this snapshot recorded is written back explicitly here, overwriting
            // whatever is currently there (the correct "restore to this exact prior state"
            // semantic).
            await RestoreAdaptiveContentAsync(snapshot, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            // ICourseService owns Course entity mutation (AD-12) -- its own internal
            // SaveChangesAsync enlists in this same ambient transaction.
            await courseService.MarkDraftAsync(courseId, cancellationToken);
        }, cancellationToken);
    }

    private static CourseVersionDto ToVersionDto(CourseVersion version)
    {
        var snapshot = JsonSerializer.Deserialize<SnapshotContent>(version.SnapshotJson, JsonOptions)!;
        return new CourseVersionDto(version.Id, version.PublishedAt, snapshot.Chapters.Count, snapshot.Chapters.Sum(c => c.Topics.Count));
    }

    // Code-review patch: writes every Level/Way this snapshot recorded back onto the live
    // DrilldownLevel/WayContent rows for that (Topic/Subtopic, number), overwriting whatever
    // GeneratedContentJson/OverrideContentJson is currently there -- the actual "restore the
    // archived adaptive content" half of a version restore, not just the tree structure.
    // Deliberately does NOT delete a live row whose (node, number) the snapshot never recorded
    // (e.g. generated after this version was published) -- that row's parent node either still
    // exists in the restored tree (in which case leaving a since-generated Level/Way in place is
    // no worse than this system's existing tolerance for orphaned adaptive-content rows once a
    // node is deleted elsewhere, since neither entity has a FK relationship to begin with) or it
    // doesn't (already orphaned, same pre-existing characteristic).
    private async Task RestoreAdaptiveContentAsync(SnapshotContent snapshot, CancellationToken cancellationToken)
    {
        foreach (var node in snapshot.AdaptiveContent)
        {
            foreach (var level in node.Levels)
            {
                var row = await adaptiveLearningRepository.GetLevelAsync(node.TopicId, node.SubtopicId, level.Number, cancellationToken);
                if (row is not null)
                {
                    row.GeneratedContentJson = level.GeneratedContentJson;
                    row.OverrideContentJson = level.OverrideContentJson;
                }
                else
                {
                    adaptiveLearningRepository.AddLevel(new DrilldownLevel
                    {
                        Id = idGenerator.NewId(),
                        TopicId = node.TopicId,
                        SubtopicId = node.SubtopicId,
                        LevelNumber = level.Number,
                        GeneratedContentJson = level.GeneratedContentJson,
                        OverrideContentJson = level.OverrideContentJson,
                    });
                }
            }

            foreach (var way in node.Ways)
            {
                var row = await adaptiveLearningRepository.GetWayAsync(node.TopicId, node.SubtopicId, way.Number, cancellationToken);
                if (row is not null)
                {
                    row.GeneratedContentJson = way.GeneratedContentJson;
                    row.OverrideContentJson = way.OverrideContentJson;
                }
                else
                {
                    adaptiveLearningRepository.AddWay(new WayContent
                    {
                        Id = idGenerator.NewId(),
                        TopicId = node.TopicId,
                        SubtopicId = node.SubtopicId,
                        WayNumber = way.Number,
                        GeneratedContentJson = way.GeneratedContentJson,
                        OverrideContentJson = way.OverrideContentJson,
                    });
                }
            }
        }
    }

    private async Task<SnapshotNodeContent> CollectNodeContentAsync(string? topicId, string? subtopicId, CancellationToken cancellationToken)
    {
        var levels = new List<SnapshotLevelOrWay>();
        for (var level = 1; level <= 5; level++)
        {
            var row = await adaptiveLearningRepository.GetLevelAsync(topicId, subtopicId, level, cancellationToken);
            if (row is not null)
                levels.Add(new SnapshotLevelOrWay(level, row.GeneratedContentJson, row.OverrideContentJson));
        }

        var ways = new List<SnapshotLevelOrWay>();
        for (var wayNumber = 1; wayNumber <= 5; wayNumber++)
        {
            var row = await adaptiveLearningRepository.GetWayAsync(topicId, subtopicId, wayNumber, cancellationToken);
            if (row is not null)
                ways.Add(new SnapshotLevelOrWay(wayNumber, row.GeneratedContentJson, row.OverrideContentJson));
        }

        return new SnapshotNodeContent(topicId, subtopicId, levels, ways);
    }

    private sealed record SnapshotContent(IReadOnlyList<Chapter> Chapters, IReadOnlyList<SnapshotNodeContent> AdaptiveContent);
    private sealed record SnapshotNodeContent(string? TopicId, string? SubtopicId, IReadOnlyList<SnapshotLevelOrWay> Levels, IReadOnlyList<SnapshotLevelOrWay> Ways);
    private sealed record SnapshotLevelOrWay(int Number, string? GeneratedContentJson, string? OverrideContentJson);
}
