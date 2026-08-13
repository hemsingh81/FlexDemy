using System.Text;
using System.Text.RegularExpressions;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.7/Task 3: third and last consumer of the Application/AdaptiveLearning feature folder's
// generated/override persistence shape and student-read-vs-tutor-write auth pattern (Stories
// 3.5/3.6). Per-course cache scoping (IKeywordDefinitionRepository.GetAsync's own (courseId,
// normalizedKeyword) key) makes AC#3 true by construction -- never key a lookup on
// normalizedKeyword alone across courses.
public class KeywordDefinitionService(
    IKeywordDefinitionRepository repository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    IAiTaskGateway aiTaskGateway) : IKeywordDefinitionService
{
    public async Task<KeywordDefinitionDto> DefineAsync(string courseId, string keyword, CancellationToken cancellationToken = default)
    {
        // Story 3.9/Task 2: widened gate matching AdaptiveLearningService/ExerciseService's own
        // identical widening (Review-as-Student needs keyword lookups too, per this epic's UJ-4).
        // Story 3.7 originally had no explicit gate at all here -- GetCourseByIdAsync's own
        // ownership-hiding behavior happened to already restrict a non-owner to Published courses
        // only, but didn't exclude a Draft course for the owning tutor, unlike the sibling gates.
        await EnsureViewableForGenerationAsync(courseId, cancellationToken);

        var normalizedKeyword = Normalize(keyword);
        var existing = await repository.GetAsync(courseId, normalizedKeyword, cancellationToken);
        if (existing is not null && (existing.GeneratedDefinitionText is not null || existing.OverrideDefinitionText is not null))
            return ToDto(keyword, existing);

        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        var tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);
        var messages = KeywordDefinitionPromptBuilder.BuildMessages(keyword, course.Subject);

        // Best-effort, non-blocking generation -- matches Story 2.10's DescribeNotationAsync/
        // TryDescribeNotationAsync precedent exactly: only the two expected, non-bug
        // AI-availability failure modes are caught here (gateway down / budget exceeded); an
        // unusable AI response (AiResponseValidationException, below) propagates as a genuine bug
        // signal instead, same as every other AI Task call site in this feature area.
        string generatedText;
        try
        {
            var result = await aiTaskGateway.DefineKeywordAsync(new AiTaskRequest(messages, CourseId: courseId, TutorId: tutorId), cancellationToken);

            if (!AdaptiveLearningResponseParser.TryParseKeywordDefinition(result.Content, out var definition, out var parseError))
                throw new AiResponseValidationException($"Keyword definition generation produced an unusable response: {parseError}");

            generatedText = definition!;
        }
        catch (AiTaskUnavailableException)
        {
            return new KeywordDefinitionDto(keyword, null, false);
        }
        catch (AiTaskBudgetExceededException)
        {
            return new KeywordDefinitionDto(keyword, null, false);
        }

        var row = await UpsertGeneratedAsync(courseId, keyword, normalizedKeyword, generatedText, cancellationToken);
        return ToDto(keyword, row);
    }

    public async Task SetOverrideAsync(string courseId, string keyword, string definitionText, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedAsync(courseId, cancellationToken);

        if (string.IsNullOrWhiteSpace(definitionText))
            throw new ValidationException("Definition text is required.");

        var normalizedKeyword = Normalize(keyword);
        await UpsertOverrideAsync(courseId, keyword, normalizedKeyword, definitionText, cancellationToken);
    }

    // Code-review-lesson-applied-proactively: the existence check and the SaveChangesAsync below
    // are not atomic -- two concurrent requests generating this exact (course, keyword) for the
    // first time (a realistic scenario: two students clicking the same never-before-seen keyword
    // at once) can both see no row, both insert, and the second SaveChangesAsync then fails
    // against the unique index (KeywordDefinitionConfiguration.cs) that correctly rejects the
    // duplicate. Same class of race Story 3.5/3.6's own analogous upserts were patched for --
    // applied here from the start rather than waiting for a review pass to catch it a third time.
    // FlexDemy.Application has no EF Core package reference (Clean Architecture boundary), so this
    // catches broadly, then verifies the failure was actually a lost race by re-checking whether
    // the row now exists, rethrowing untouched if it doesn't. On a real lost race, the winner's
    // row already has valid generated content (it went through this exact same code path), so
    // that's returned directly -- our own freshly generated content is discarded.
    private async Task<KeywordDefinition> UpsertGeneratedAsync(string courseId, string keyword, string normalizedKeyword, string generatedText, CancellationToken cancellationToken)
    {
        var row = await repository.GetAsync(courseId, normalizedKeyword, cancellationToken);
        if (row is not null)
        {
            row.GeneratedDefinitionText = generatedText;
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return row;
        }

        var newRow = new KeywordDefinition
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            Keyword = keyword,
            NormalizedKeyword = normalizedKeyword,
            GeneratedDefinitionText = generatedText,
        };
        repository.Add(newRow);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return newRow;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var winner = await repository.GetAsync(courseId, normalizedKeyword, cancellationToken);
            if (winner is null) throw;
            return winner;
        }
    }

    // Same lost-insert-race scenario as UpsertGeneratedAsync, but a tutor's own explicit override
    // write must still take effect even after losing the race -- retries as an UPDATE against the
    // now-existing winner row instead (last-write-wins for a deliberate edit action), matching
    // Story 3.5/3.6's own override-path precedent.
    private async Task UpsertOverrideAsync(string courseId, string keyword, string normalizedKeyword, string overrideText, CancellationToken cancellationToken)
    {
        var row = await repository.GetAsync(courseId, normalizedKeyword, cancellationToken);
        if (row is not null)
        {
            row.OverrideDefinitionText = overrideText;
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return;
        }

        var newRow = new KeywordDefinition
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            Keyword = keyword,
            NormalizedKeyword = normalizedKeyword,
            OverrideDefinitionText = overrideText,
        };
        repository.Add(newRow);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var winner = await repository.GetAsync(courseId, normalizedKeyword, cancellationToken);
            if (winner is null) throw;
            winner.OverrideDefinitionText = overrideText;
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }

    // Story 3.9/Task 2: identical widened gate/reasoning as AdaptiveLearningService's own
    // EnsureViewableForGenerationAsync and ExerciseService's own copy of it.
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

    // Code-review patch: Trim()+ToLowerInvariant() alone doesn't guarantee two requests for what a
    // user considers "the same" keyword produce the identical cache key -- neither collapses
    // internal whitespace runs (e.g. "wave length" vs "wave  length", plausible from an HTML
    // text-node join or copy-paste) nor applies Unicode normalization (precomposed vs. decomposed
    // forms of the same visible non-ASCII text, relevant since Hindi content is in this
    // platform's stated scope). Left uncollapsed, this doesn't just waste a redundant AI call --
    // it silently breaks AC#2 from the caller's perspective: a tutor's SetOverrideAsync writes an
    // override keyed on one whitespace/Unicode variant, and a student's lookup on a
    // differently-rendered variant of the same visible phrase resolves to a different row with no
    // override, silently falling through to (or generating) an AI definition instead.
    private static readonly Regex WhitespaceRun = new(@"\s+", RegexOptions.Compiled);

    private static string Normalize(string keyword) =>
        WhitespaceRun.Replace(keyword.Trim(), " ").Normalize(NormalizationForm.FormKC).ToLowerInvariant();

    private static KeywordDefinitionDto ToDto(string keyword, KeywordDefinition row) =>
        new(keyword, row.OverrideDefinitionText ?? row.GeneratedDefinitionText, row.OverrideDefinitionText is not null);
}
