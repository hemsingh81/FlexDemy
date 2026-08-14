using System.Text.Json;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.Jobs;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

public class ExtractStructureJob(
    ICourseFileRepository repository,
    IUnitOfWork unitOfWork,
    ICourseService courseService,
    IAiTaskGateway aiTaskGateway,
    ICorrelationIdAccessor correlationIdAccessor,
    IErrorCaptureService errorCaptureService) : IExtractStructureJob
{
    // Matches [AutomaticRetry(Attempts = MaxAttempts)] below -- same discipline as
    // ScanFileJob/ParseFileJob (Stories 2.6/2.7): an explicit constant, not Hangfire's implicit default.
    private const int MaxAttempts = 5;

    // Matches the course_files.failure_reason column's HasMaxLength(1024).
    private const int MaxFailureReasonLength = 1024;

    // Code-review patch: without an explicit value, AiTaskRequest.MaxTokens defaults to null and
    // the provider's own default applies -- a real curriculum extraction (many chapters/topics/
    // subtopics/content blocks) is exactly the output-token-heavy case where that default could
    // truncate the response mid-JSON, causing ExtractionResponseParser.TryParse to fail on
    // malformed JSON. [ASSUMPTION: 8000 tokens is a generous-but-unverified starting point for a
    // typical single-document extraction; confirm against real output sizes during dev.]
    private const int MaxCompletionTokens = 8000;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)
    {
        // Story 4.1/AD-23: see ScanFileJob's own comment for why this is the first line.
        correlationIdAccessor.Set(correlationId);

        var courseFile = await repository.GetByIdAsync(courseFileId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.CourseFile), courseFileId);

        // Idempotency guard: unlike ParseFileJob, this job makes no interim write -- a CourseFile
        // reaching it already has Status == Extracting (Story 2.7's own forward-looking marker)
        // and stays there across every retry attempt until this job's one terminal write. Only an
        // already-terminal row (Done/Failed, from a prior completed attempt) is skipped.
        if (courseFile.Status != JobItemStatus.Extracting)
            return;

        // Defensive guard: a CourseFile reaching this job should always have ParsedContent set by
        // Story 2.7's own contract, but cheap insurance against a broken chain elsewhere.
        if (string.IsNullOrWhiteSpace(courseFile.ParsedContent))
        {
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = "No parsed content available for extraction.";
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return;
        }

        try
        {
            var tutorId = await courseService.GetOwningTutorIdAsync(courseFile.CourseId, cancellationToken);
            var messages = ExtractionPromptBuilder.BuildMessages(courseFile.ParsedContent);
            var result = await aiTaskGateway.ExtractStructureAsync(
                new AiTaskRequest(messages, MaxTokens: MaxCompletionTokens, CourseId: courseFile.CourseId, TutorId: tutorId), cancellationToken);

            if (ExtractionResponseParser.TryParse(result.Content, out var structure, out var parseError))
            {
                courseFile.Status = JobItemStatus.Done;
                courseFile.ExtractedStructureJson = JsonSerializer.Serialize(structure, JsonOptions);
                courseFile.FailureReason = null;
            }
            else
            {
                // AC#2's own equivalent of Story 2.7's low-confidence case: a malformed or
                // schema-incomplete AI response routes to Failed, not a silent broken structure.
                courseFile.Status = JobItemStatus.Failed;
                courseFile.FailureReason = Truncate(parseError ?? "Extraction response could not be parsed.");
                await unitOfWork.SaveChangesAsync(cancellationToken);

                // Story 4.3/FR-3: a terminal failure that never went through the exception-based
                // retry path at all -- TryParse failing is a parsed-but-invalid response, not a
                // thrown exception, so there's no ExceptionType to read here.
                await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
                {
                    ExceptionType = null,
                    Message = parseError ?? "Extraction response could not be parsed.",
                    Source = ErrorSource.Backend,
                    OriginContext = nameof(ExtractStructureJob),
                    RelatedEntityType = nameof(Domain.Courses.CourseFile),
                    RelatedEntityId = courseFile.Id,
                    IsBackgroundJobFailure = true,
                }, cancellationToken);
                return;
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (AiTaskBudgetExceededException ex)
        {
            // No retry -- retrying immediately cannot un-exceed a budget threshold still in effect.
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = "AI budget exceeded for extraction.";
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Story 4.3/FR-3/FR-4: mirrors the existing terminal write above, doesn't replace it.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = nameof(ExtractStructureJob),
                RelatedEntityType = nameof(Domain.Courses.CourseFile),
                RelatedEntityId = courseFile.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Every other exception (AiTaskUnavailableException, a config-lookup NotFoundException,
            // or anything else genuinely unexpected) is retry-worthy -- same generalized
            // retry-then-fail-closed shape as ScanFileJob/ParseFileJob.
            var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
            if (retryCount < MaxAttempts - 1)
                throw; // Let it propagate uncaught -- triggers Hangfire's automatic retry.

            // Code-review patch: matches ScanFileJob/ParseFileJob's identical final-attempt
            // message format -- an unexplained inconsistency otherwise, for the two jobs this
            // story explicitly claims to mirror.
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = Truncate(
                ex is AiTaskUnavailableException
                    ? "AI extraction unavailable — retries exhausted"
                    : $"Extraction failed — retries exhausted ({ex.GetType().Name})");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Story 4.3/FR-3/FR-4: mirrors the existing terminal write above, doesn't replace it.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = nameof(ExtractStructureJob),
                RelatedEntityType = nameof(Domain.Courses.CourseFile),
                RelatedEntityId = courseFile.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
    }

    private static string Truncate(string reason) =>
        reason.Length > MaxFailureReasonLength ? reason[..MaxFailureReasonLength] : reason;
}
