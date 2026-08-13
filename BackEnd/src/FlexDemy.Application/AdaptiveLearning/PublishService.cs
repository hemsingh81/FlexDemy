using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.8/Task 5: the tutor-facing publish trigger + checklist read. Depends on ICourseService
// (never ICourseRepository directly, AD-12) for the LifecycleState check and the terminal
// Published transition (delegated to ICourseService.MarkPublishedAsync, since only Courses' own
// service may mutate a Course entity), and on IContentTreeRepository directly -- the same
// cross-feature repository reuse Story 3.5's AdaptiveLearningService already established as this
// epic's own precedent for "both features must agree on one tree shape."
public class PublishService(
    ICourseService courseService,
    IContentTreeRepository contentTreeRepository,
    IPublishBatchRepository repository,
    IVersionService versionService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    IPublishNodeContentJobEnqueuer jobEnqueuer) : IPublishService
{
    public async Task PublishAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        if (course.LifecycleState != nameof(LifecycleState.ReviewConfirmed))
            throw new ValidationException("A course can only be published once its review has been confirmed.");

        // Code-review patch: LifecycleState stays ReviewConfirmed for the entire publishing
        // duration by design (it only flips to Published once the batch finishes), so the check
        // above alone cannot reject a second trigger while a batch is already running -- a
        // double-click or client retry would otherwise spin up a whole second PublishBatch and
        // duplicate every confirmed node's AI generation work. Guard explicitly against an
        // already-active batch for this course instead.
        var existingBatch = await repository.GetLatestByCourseIdAsync(courseId, cancellationToken);
        if (existingBatch is not null && existingBatch.Remaining > 0)
            throw new ValidationException("This course is already being published.");

        var confirmedNodes = await GetConfirmedNodesAsync(courseId, cancellationToken);

        if (confirmedNodes.Count == 0)
        {
            // No confirmed nodes at all -- nothing to pre-generate, but a course can still
            // legitimately publish (an edge case, not a validation error). AD-16's per-item
            // decrement never fires when there are zero items, so this trigger must finalize
            // immediately itself instead of leaving the course stuck in ReviewConfirmed forever.
            await versionService.CreateSnapshotAsync(courseId, cancellationToken);
            await courseService.MarkPublishedAsync(courseId, cancellationToken);
            return;
        }

        var batch = new PublishBatch
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            TotalNodes = confirmedNodes.Count,
            Remaining = confirmedNodes.Count,
        };
        repository.AddBatch(batch);

        var items = confirmedNodes.Select(node => new PublishBatchItem
        {
            Id = idGenerator.NewId(),
            BatchId = batch.Id,
            TopicId = node.TopicId,
            SubtopicId = node.SubtopicId,
            Status = PublishItemStatus.Queued,
            ProgressText = "Queued",
        }).ToList();
        foreach (var item in items)
            repository.AddItem(item);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Enqueued only after the items are committed -- a job that starts before its own
        // PublishBatchItem row exists would fail its GetItemByIdAsync lookup.
        foreach (var item in items)
            jobEnqueuer.Enqueue(item.Id);
    }

    public async Task<PublishStatusDto> GetStatusAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        var batch = await repository.GetLatestByCourseIdAsync(courseId, cancellationToken);

        if (batch is null)
            return new PublishStatusDto(course.LifecycleState, false, null);

        var items = await repository.GetItemsByBatchIdAsync(batch.Id, cancellationToken);
        var checklist = await BuildChecklistAsync(courseId, items, cancellationToken);

        return new PublishStatusDto(course.LifecycleState, batch.Remaining > 0, checklist);
    }

    private async Task<List<(string? TopicId, string? SubtopicId)>> GetConfirmedNodesAsync(string courseId, CancellationToken cancellationToken)
    {
        var chapters = await contentTreeRepository.GetTreeAsync(courseId, cancellationToken);
        var nodes = new List<(string? TopicId, string? SubtopicId)>();

        foreach (var chapter in chapters)
        {
            foreach (var topic in chapter.Topics)
            {
                if (topic.Confirmation == NodeConfirmation.Confirmed)
                    nodes.Add((topic.Id, null));

                foreach (var subtopic in topic.Subtopics)
                {
                    if (subtopic.Confirmation == NodeConfirmation.Confirmed)
                        nodes.Add((null, subtopic.Id));
                }
            }
        }

        return nodes;
    }

    // Chapter rows are structural/grouping headers only, never generation-tracked (Story 3.4's
    // own established convention, since Chapters are never FR17/18 generation targets) -- a
    // chapter row is included only when it has at least one batch item under it, so a chapter
    // with nothing confirmed doesn't show an empty header.
    private async Task<List<ChecklistRowDto>> BuildChecklistAsync(string courseId, List<PublishBatchItem> items, CancellationToken cancellationToken)
    {
        var itemsByTopicId = items.Where(i => i.TopicId is not null).ToDictionary(i => i.TopicId!);
        var itemsBySubtopicId = items.Where(i => i.SubtopicId is not null).ToDictionary(i => i.SubtopicId!);

        var chapters = await contentTreeRepository.GetTreeAsync(courseId, cancellationToken);
        var rows = new List<ChecklistRowDto>();

        foreach (var chapter in chapters)
        {
            var hasAnyItem = chapter.Topics.Any(t => itemsByTopicId.ContainsKey(t.Id) || t.Subtopics.Any(s => itemsBySubtopicId.ContainsKey(s.Id)));
            if (!hasAnyItem)
                continue;

            rows.Add(new ChecklistRowDto(chapter.Id, "chapter", chapter.Title, "done", ""));

            foreach (var topic in chapter.Topics)
            {
                if (itemsByTopicId.TryGetValue(topic.Id, out var topicItem))
                    rows.Add(ToRow(topic.Id, "topic", topic.Title, topicItem));

                foreach (var subtopic in topic.Subtopics)
                {
                    if (itemsBySubtopicId.TryGetValue(subtopic.Id, out var subtopicItem))
                        rows.Add(ToRow(subtopic.Id, "subtopic", subtopic.Title, subtopicItem));
                }
            }
        }

        return rows;
    }

    private static ChecklistRowDto ToRow(string nodeId, string nodeKind, string title, PublishBatchItem item) =>
        new(nodeId, nodeKind, title, ToStatusKind(item.Status), item.ProgressText ?? "");

    private static string ToStatusKind(PublishItemStatus status) => status switch
    {
        PublishItemStatus.Queued => "pending",
        PublishItemStatus.InProgress => "inProgress",
        PublishItemStatus.Done => "done",
        PublishItemStatus.Failed => "failed",
        _ => "pending",
    };
}
