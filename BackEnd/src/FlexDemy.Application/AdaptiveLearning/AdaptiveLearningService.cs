using System.Text.Json;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.5/Task 3: depends on IAiTaskGateway (never IAiGateway directly, AD-14),
// IContentTreeRepository (reused read access to a Topic/Subtopic's ContentBlocks -- not a
// parallel content-tree reader, per this story's own Task 3 instruction), and
// IAdaptiveLearningRepository for the two new entities. Generation here is a plain synchronous
// service call, never a Hangfire job of its own -- Story 3.8 owns the batch job that calls
// GenerateLevelAsync/GenerateWayAsync once per confirmed node at publish time; this story's
// on-demand fallback also calls them synchronously, inline in a normal HTTP request (same AD-14
// "authoring/viewing-time, not batch-async" reasoning Story 2.10's DescribeNotationAsync call
// already established).
public class AdaptiveLearningService(
    IAdaptiveLearningRepository repository,
    IContentTreeRepository contentTreeRepository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    IAiTaskGateway aiTaskGateway) : IAdaptiveLearningService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<DrilldownLevelDto> GenerateLevelAsync(string courseId, string nodeId, int level, CancellationToken cancellationToken = default)
    {
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);
        var nodeContent = await ResolveNodeContentAsync(topicId, subtopicId, cancellationToken);
        var tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);

        var messages = DrilldownPromptBuilder.BuildMessages(nodeContent, level);
        var result = await aiTaskGateway.ExplainTopicAsync(new AiTaskRequest(messages, CourseId: courseId, TutorId: tutorId), cancellationToken);

        if (!AdaptiveLearningResponseParser.TryParseLevel(result.Content, out var content, out var parseError))
            throw new AiResponseValidationException($"Drill-Down generation produced an unusable response: {parseError}");

        var row = await UpsertGeneratedLevelAsync(topicId, subtopicId, level, JsonSerializer.Serialize(content, JsonOptions), cancellationToken);
        return ToDto(nodeId, level, row);
    }

    public async Task<WayContentDto> GenerateWayAsync(string courseId, string nodeId, int wayNumber, CancellationToken cancellationToken = default)
    {
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);
        var nodeContent = await ResolveNodeContentAsync(topicId, subtopicId, cancellationToken);
        var tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);

        var messages = WaysPromptBuilder.BuildMessages(nodeContent, wayNumber);
        var result = await aiTaskGateway.RewriteExplanationAsync(new AiTaskRequest(messages, CourseId: courseId, TutorId: tutorId), cancellationToken);

        if (!AdaptiveLearningResponseParser.TryParseWay(result.Content, out var content, out var parseError))
            throw new AiResponseValidationException($"Ways generation produced an unusable response: {parseError}");

        var row = await UpsertGeneratedWayAsync(topicId, subtopicId, wayNumber, JsonSerializer.Serialize(content, JsonOptions), cancellationToken);
        return ToDto(nodeId, wayNumber, row);
    }

    public async Task<DrilldownLevelDto> GetOrGenerateLevelAsync(string courseId, string nodeId, int level, CancellationToken cancellationToken = default)
    {
        await EnsureViewableForGenerationAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);

        var existing = await repository.GetLevelAsync(topicId, subtopicId, level, cancellationToken);
        if (existing is not null && (existing.GeneratedContentJson is not null || existing.OverrideContentJson is not null))
            return ToDto(nodeId, level, existing);

        return await GenerateLevelAsync(courseId, nodeId, level, cancellationToken);
    }

    public async Task<WayContentDto> GetOrGenerateWayAsync(string courseId, string nodeId, int wayNumber, CancellationToken cancellationToken = default)
    {
        await EnsureViewableForGenerationAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);

        var existing = await repository.GetWayAsync(topicId, subtopicId, wayNumber, cancellationToken);
        if (existing is not null && (existing.GeneratedContentJson is not null || existing.OverrideContentJson is not null))
            return ToDto(nodeId, wayNumber, existing);

        return await GenerateWayAsync(courseId, nodeId, wayNumber, cancellationToken);
    }

    public async Task SetLevelOverrideAsync(string courseId, string nodeId, int level, DrilldownLevelContent content, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);

        // GeneratedContentJson deliberately untouched -- removing an override later falls back to
        // the last real AI generation instead of needing to regenerate.
        await UpsertLevelOverrideAsync(topicId, subtopicId, level, JsonSerializer.Serialize(content, JsonOptions), cancellationToken);
    }

    public async Task SetWayOverrideAsync(string courseId, string nodeId, int wayNumber, WayContentData content, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveGenerationTargetAsync(courseId, nodeId, cancellationToken);

        await UpsertWayOverrideAsync(topicId, subtopicId, wayNumber, JsonSerializer.Serialize(content, JsonOptions), cancellationToken);
    }

    // Code-review patch: the existence check (GetLevelAsync) and the SaveChangesAsync below are
    // not atomic -- see RaceRetryUpsert.UpsertWithRaceRetryAsync (Application/Common) for the full
    // race explanation this and every other Upsert* method in this file/feature area shares.
    private Task<DrilldownLevel> UpsertGeneratedLevelAsync(string? topicId, string? subtopicId, int level, string generatedContentJson, CancellationToken cancellationToken) =>
        RaceRetryUpsert.UpsertWithRaceRetryAsync(
            lookup: ct => repository.GetLevelAsync(topicId, subtopicId, level, ct),
            createNew: () => new DrilldownLevel { Id = idGenerator.NewId(), TopicId = topicId, SubtopicId = subtopicId, LevelNumber = level, GeneratedContentJson = generatedContentJson },
            add: repository.AddLevel,
            applyUpdate: row => row.GeneratedContentJson = generatedContentJson,
            applyUpdateOnRaceLoss: false, // a generation loser's redundant AI output is discarded -- the winner's row already has valid generated content.
            unitOfWork: unitOfWork,
            cancellationToken: cancellationToken);

    // Same race as UpsertGeneratedLevelAsync, mirrored for Ways.
    private Task<WayContent> UpsertGeneratedWayAsync(string? topicId, string? subtopicId, int wayNumber, string generatedContentJson, CancellationToken cancellationToken) =>
        RaceRetryUpsert.UpsertWithRaceRetryAsync(
            lookup: ct => repository.GetWayAsync(topicId, subtopicId, wayNumber, ct),
            createNew: () => new WayContent { Id = idGenerator.NewId(), TopicId = topicId, SubtopicId = subtopicId, WayNumber = wayNumber, GeneratedContentJson = generatedContentJson },
            add: repository.AddWay,
            applyUpdate: row => row.GeneratedContentJson = generatedContentJson,
            applyUpdateOnRaceLoss: false,
            unitOfWork: unitOfWork,
            cancellationToken: cancellationToken);

    // Same lost-insert-race scenario as UpsertGeneratedLevelAsync, but a tutor's own explicit
    // override write must still take effect even after losing the race -- unlike generation
    // (where the loser's redundant AI output is simply discarded), this retries as an UPDATE
    // against the now-existing winner row instead (last-write-wins for a deliberate edit action).
    private async Task UpsertLevelOverrideAsync(string? topicId, string? subtopicId, int level, string overrideContentJson, CancellationToken cancellationToken) =>
        await RaceRetryUpsert.UpsertWithRaceRetryAsync(
            lookup: ct => repository.GetLevelAsync(topicId, subtopicId, level, ct),
            createNew: () => new DrilldownLevel { Id = idGenerator.NewId(), TopicId = topicId, SubtopicId = subtopicId, LevelNumber = level, OverrideContentJson = overrideContentJson },
            add: repository.AddLevel,
            applyUpdate: row => row.OverrideContentJson = overrideContentJson,
            applyUpdateOnRaceLoss: true,
            unitOfWork: unitOfWork,
            cancellationToken: cancellationToken);

    // Same last-write-wins retry as UpsertLevelOverrideAsync, mirrored for Ways.
    private async Task UpsertWayOverrideAsync(string? topicId, string? subtopicId, int wayNumber, string overrideContentJson, CancellationToken cancellationToken) =>
        await RaceRetryUpsert.UpsertWithRaceRetryAsync(
            lookup: ct => repository.GetWayAsync(topicId, subtopicId, wayNumber, ct),
            createNew: () => new WayContent { Id = idGenerator.NewId(), TopicId = topicId, SubtopicId = subtopicId, WayNumber = wayNumber, OverrideContentJson = overrideContentJson },
            add: repository.AddWay,
            applyUpdate: row => row.OverrideContentJson = overrideContentJson,
            applyUpdateOnRaceLoss: true,
            unitOfWork: unitOfWork,
            cancellationToken: cancellationToken);

    // AC#4 (Story 3.5) + Story 3.9/Task 2: a student reads Drill-Down/Ways only for a genuinely
    // Published course; a tutor previewing their own course via Review-as-Student additionally
    // needs this same generate-or-serve-cached path for the two later pre-publish lifecycle
    // states (widened from the original Published-only gate, which Story 3.5's own Dev Notes
    // explicitly flagged as needing this resolution). Draft is deliberately still excluded --
    // Review-as-Student is only reachable once MoveToReviewAsync has already run.
    private async Task EnsureViewableForGenerationAsync(string courseId, CancellationToken cancellationToken)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        if (course.LifecycleState == nameof(LifecycleState.Published))
            return;

        if (course.LifecycleState is nameof(LifecycleState.InReview) or nameof(LifecycleState.ReviewConfirmed))
        {
            // GetCourseByIdAsync above already hid a non-Published course from a non-owner
            // (NotFoundException) -- EnsureOwnedAsync is reused explicitly here anyway rather
            // than relying on that as an implicit side effect of a different method's contract.
            await courseService.EnsureOwnedAsync(courseId, cancellationToken);
            return;
        }

        throw new NotFoundException(nameof(Domain.Courses.Course), courseId);
    }

    // Confirmed-node scope: only Topic/Subtopic nodes are Drill-Down/Ways generation targets
    // (never Chapter, never ContentBlock) -- reject anything else.
    private async Task<(string? TopicId, string? SubtopicId)> ResolveGenerationTargetAsync(string courseId, string nodeId, CancellationToken cancellationToken)
    {
        var node = await contentTreeRepository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Topic is not null) return (node.Topic.Id, null);
        if (node.Subtopic is not null) return (null, node.Subtopic.Id);

        throw new ValidationException("Drill-Down/Ways content can only be generated for a Topic or Subtopic.");
    }

    // The node's own aggregated ContentBlock text -- the raw material Drill-Down/Ways explains,
    // analogous to how ExtractionPromptBuilder takes a whole document's ParsedContent.
    private async Task<string> ResolveNodeContentAsync(string? topicId, string? subtopicId, CancellationToken cancellationToken)
    {
        var blocks = topicId is not null
            ? await contentTreeRepository.GetContentBlocksByTopicIdAsync(topicId, cancellationToken)
            : await contentTreeRepository.GetContentBlocksBySubtopicIdAsync(subtopicId!, cancellationToken);

        var parts = blocks
            .Select(b => b.Format == ContentBlockFormat.Math ? b.Notation : b.Text)
            .Where(part => !string.IsNullOrWhiteSpace(part));

        return string.Join("\n\n", parts);
    }

    private static DrilldownLevelDto ToDto(string nodeId, int level, DrilldownLevel row)
    {
        var json = row.OverrideContentJson ?? row.GeneratedContentJson
            ?? throw new InvalidOperationException($"DrilldownLevel row '{row.Id}' has neither generated nor override content.");
        var content = JsonSerializer.Deserialize<DrilldownLevelContent>(json, JsonOptions)!;

        return new DrilldownLevelDto(
            nodeId, level, content.Title, content.Subtitle, content.Content, content.KeyPoints, content.MathFormulas,
            content.Examples.Select(ToDto).ToList(), row.OverrideContentJson is not null);
    }

    private static WayContentDto ToDto(string nodeId, int wayNumber, WayContent row)
    {
        var json = row.OverrideContentJson ?? row.GeneratedContentJson
            ?? throw new InvalidOperationException($"WayContent row '{row.Id}' has neither generated nor override content.");
        var content = JsonSerializer.Deserialize<WayContentData>(json, JsonOptions)!;

        return new WayContentDto(nodeId, wayNumber, content.Explanation, ToDto(content.Example), row.OverrideContentJson is not null);
    }

    private static ExampleItemDto ToDto(ExampleItemContent example) =>
        new(example.Id, example.Title, example.Problem, example.StepByStepSolution, example.FinalAnswer, example.Difficulty);
}
