using System.Globalization;
using System.Text.Json;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.6/Task 3: same Application/AdaptiveLearning feature folder, reused IContentTreeRepository
// read access, and student-read-vs-tutor-write auth-shape decision Story 3.5 established.
public class ExerciseService(
    IExerciseRepository repository,
    IContentTreeRepository contentTreeRepository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    IAiTaskGateway aiTaskGateway) : IExerciseService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ExerciseDraftDto> ProposeExerciseAsync(string courseId, string nodeId, AnswerType answerType, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveNodeAsync(courseId, nodeId, cancellationToken);
        var nodeContent = await ResolveNodeContentAsync(topicId, subtopicId, cancellationToken);
        var tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);

        var messages = ExerciseGenerationPromptBuilder.BuildMessages(nodeContent, answerType);
        var result = await aiTaskGateway.GenerateExerciseAsync(new AiTaskRequest(messages, CourseId: courseId, TutorId: tutorId), cancellationToken);

        if (!AdaptiveLearningResponseParser.TryParseExercise(result.Content, answerType, out var content, out var parseError))
            throw new AiResponseValidationException($"Exercise generation produced an unusable response: {parseError}");

        return new ExerciseDraftDto(answerType.ToString(), content!.QuestionText, content.Options, content.CorrectAnswer, content.FeedbackText);
    }

    public async Task<ExerciseDto> SaveExerciseAsync(string courseId, string nodeId, SaveExerciseRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveNodeAsync(courseId, nodeId, cancellationToken);

        if (!Enum.TryParse<AnswerType>(request.AnswerType, ignoreCase: true, out var answerType))
            throw new ValidationException($"Invalid answer type '{request.AnswerType}'.");
        if (string.IsNullOrWhiteSpace(request.QuestionText))
            throw new ValidationException("Question text is required.");
        if (string.IsNullOrWhiteSpace(request.CorrectAnswer))
            throw new ValidationException("Correct answer is required.");
        if (string.IsNullOrWhiteSpace(request.FeedbackText))
            throw new ValidationException("Feedback text is required.");
        // Code-review patch: TryParseExercise (the AI-generation path) already enforces both of
        // these invariants on its own output -- this manual tutor-save path is a separate entry
        // point (self-authored, or an AI proposal the tutor edited afterward) that must enforce
        // them too, or a tutor could silently save a permanently unanswerable exercise (a
        // MultipleChoice whose CorrectAnswer isn't one of its own Options, or a Numeric whose
        // CorrectAnswer doesn't parse as a number) -- SubmitAnswerAsync would then never be able
        // to grade a correct answer for it.
        if (answerType == AnswerType.MultipleChoice)
        {
            if (request.Options is not { Count: >= 2 })
                throw new ValidationException("A multiple-choice exercise needs at least 2 options.");
            if (!request.Options.Contains(request.CorrectAnswer))
                throw new ValidationException("The correct answer must be one of the supplied options.");
        }
        else if (answerType == AnswerType.Numeric && !double.TryParse(request.CorrectAnswer.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out _))
        {
            throw new ValidationException("A numeric exercise's correct answer must be a plain number.");
        }

        var optionsJson = request.Options is null ? null : JsonSerializer.Serialize(request.Options, JsonOptions);
        var saved = await UpsertExerciseAsync(topicId, subtopicId, answerType, request, optionsJson, cancellationToken);
        return ToDto(nodeId, saved);
    }

    // Code-review patch: the existence check (GetByNodeAsync) and the SaveChangesAsync below are
    // not atomic -- see RaceRetryUpsert.UpsertWithRaceRetryAsync (Application/Common) for the full
    // race explanation this shares with AdaptiveLearningService's/KeywordDefinitionService's own
    // analogous upserts. Unlike those services' AI-generation paths (which discard the loser's
    // redundant AI output), a tutor's own explicit save must still take effect (last-write-wins)
    // -- retried as an UPDATE against the now-existing winner row.
    private Task<Exercise> UpsertExerciseAsync(
        string? topicId, string? subtopicId, AnswerType answerType, SaveExerciseRequest request, string? optionsJson, CancellationToken cancellationToken) =>
        RaceRetryUpsert.UpsertWithRaceRetryAsync(
            lookup: ct => repository.GetByNodeAsync(topicId, subtopicId, ct),
            createNew: () => new Exercise
            {
                Id = idGenerator.NewId(),
                TopicId = topicId,
                SubtopicId = subtopicId,
                AnswerType = answerType,
                QuestionText = request.QuestionText,
                OptionsJson = optionsJson,
                CorrectAnswer = request.CorrectAnswer,
                FeedbackText = request.FeedbackText,
                IsAiProposed = request.IsAiProposed,
            },
            add: repository.Add,
            applyUpdate: row => ApplyRequest(row, answerType, request, optionsJson),
            applyUpdateOnRaceLoss: true,
            unitOfWork: unitOfWork,
            cancellationToken: cancellationToken);

    private static void ApplyRequest(Exercise exercise, AnswerType answerType, SaveExerciseRequest request, string? optionsJson)
    {
        exercise.AnswerType = answerType;
        exercise.QuestionText = request.QuestionText;
        exercise.OptionsJson = optionsJson;
        exercise.CorrectAnswer = request.CorrectAnswer;
        exercise.FeedbackText = request.FeedbackText;
        exercise.IsAiProposed = request.IsAiProposed;
    }

    public async Task DeleteExerciseAsync(string courseId, string nodeId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveNodeAsync(courseId, nodeId, cancellationToken);

        var existing = await repository.GetByNodeAsync(topicId, subtopicId, cancellationToken);
        if (existing is null)
            return;

        repository.Remove(existing);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<ExerciseDto?> GetExerciseAsync(string courseId, string nodeId, CancellationToken cancellationToken = default)
    {
        // Same posture Story 3.5's GetOrGenerateLevelAsync/GetOrGenerateWayAsync established for
        // the identical class of student-facing, node-scoped adaptive-content read (widened by
        // Story 3.9/Task 2 for the same Review-as-Student reason) -- kept consistent with that
        // sibling story's precedent rather than leaving these two read paths inconsistent within
        // the same feature area.
        await EnsureViewableForGenerationAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveNodeAsync(courseId, nodeId, cancellationToken);

        var existing = await repository.GetByNodeAsync(topicId, subtopicId, cancellationToken);
        return existing is null ? null : ToDto(nodeId, existing);
    }

    public async Task<ExerciseSubmissionResultDto> SubmitAnswerAsync(string courseId, string nodeId, string answer, CancellationToken cancellationToken = default)
    {
        await EnsureViewableForGenerationAsync(courseId, cancellationToken);
        var (topicId, subtopicId) = await ResolveNodeAsync(courseId, nodeId, cancellationToken);

        var exercise = await repository.GetByNodeAsync(topicId, subtopicId, cancellationToken)
            ?? throw new NotFoundException(nameof(Exercise), nodeId);

        return new ExerciseSubmissionResultDto(IsCorrectAnswer(exercise, answer), exercise.FeedbackText);
    }

    // Deliberate 1:1 port of Story 3.3's own mock evaluator -- case-insensitive/trimmed string
    // equality for ShortText/MultipleChoice, epsilon-tolerant numeric-parse comparison for
    // Numeric. Unlike the frontend's own mock (which originally used JS's lenient parseFloat and
    // needed a code-review patch for trailing-garbage false positives, e.g. "3xyz" matching "3"),
    // double.TryParse is strict by default -- the whole (trimmed) string must be numeric -- so no
    // equivalent bug exists here.
    private static bool IsCorrectAnswer(Exercise exercise, string answer)
    {
        if (exercise.AnswerType == AnswerType.Numeric)
        {
            if (!double.TryParse(answer.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var submittedValue))
                return false;
            if (!double.TryParse(exercise.CorrectAnswer.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var referenceValue))
                return false;
            return Math.Abs(submittedValue - referenceValue) < 1e-6;
        }

        return string.Equals(answer.Trim(), exercise.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    // Story 3.9/Task 2: widened from Published-only, mirroring AdaptiveLearningService's own
    // identical widening and identical reasoning -- see that class's EnsureViewableForGenerationAsync.
    private async Task EnsureViewableForGenerationAsync(string courseId, CancellationToken cancellationToken)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        if (course.LifecycleState == nameof(LifecycleState.Published))
            return;

        if (course.LifecycleState is nameof(LifecycleState.InReview) or nameof(LifecycleState.ReviewConfirmed))
        {
            await courseService.EnsureOwnedAsync(courseId, cancellationToken);
            return;
        }

        throw new NotFoundException(nameof(Domain.Courses.Course), courseId);
    }

    // Confirmed-node scope: only Topic/Subtopic nodes may carry an exercise (never Chapter, never
    // ContentBlock) -- same rule Story 3.5's AdaptiveLearningService enforces for Drill-Down/Ways.
    private async Task<(string? TopicId, string? SubtopicId)> ResolveNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken)
    {
        var node = await contentTreeRepository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Topic is not null) return (node.Topic.Id, null);
        if (node.Subtopic is not null) return (null, node.Subtopic.Id);

        throw new ValidationException("An exercise can only be attached to a Topic or Subtopic.");
    }

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

    private static ExerciseDto ToDto(string nodeId, Exercise exercise)
    {
        var options = exercise.OptionsJson is null ? null : JsonSerializer.Deserialize<List<string>>(exercise.OptionsJson, JsonOptions);
        return new ExerciseDto(nodeId, exercise.AnswerType.ToString(), exercise.QuestionText, options, exercise.FeedbackText, exercise.IsAiProposed);
    }
}
