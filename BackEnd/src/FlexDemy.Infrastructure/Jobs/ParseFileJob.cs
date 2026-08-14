using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.Jobs;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

public class ParseFileJob(
    ICourseFileRepository repository,
    IUnitOfWork unitOfWork,
    IFileStorageService fileStorage,
    IDocumentParser documentParser,
    ICorrelationIdAccessor correlationIdAccessor,
    IErrorCaptureService errorCaptureService) : IParseFileJob
{
    // Matches [AutomaticRetry(Attempts = MaxAttempts)] below -- same discipline as ScanFileJob
    // (Story 2.6): an explicit constant, not Hangfire's implicit default.
    private const int MaxAttempts = 5;

    // Matches the course_files.failure_reason column's HasMaxLength(1024).
    private const int MaxFailureReasonLength = 1024;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)
    {
        // Story 4.1/AD-23: see ScanFileJob's own comment for why this is the first line.
        correlationIdAccessor.Set(correlationId);

        var courseFile = await repository.GetByIdAsync(courseFileId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.CourseFile), courseFileId);

        // Idempotency guard: an already-terminal row (a prior attempt completed, or a replayed
        // execution) must not be reprocessed. Unlike ScanFileJob, `Parsing` itself is NOT a
        // terminal/skip state here -- it's this job's own legitimate in-progress marker, and a
        // retried execution after a transient failure will see it and must still continue.
        if (courseFile.Status is JobItemStatus.Failed or JobItemStatus.Done)
            return;

        try
        {
            // AC#3: commits the interim Parsing transition so a tutor polling GET .../files sees
            // it while a slow parse is still running -- only on the first attempt
            // (Queued -> Parsing); a retried execution is already Parsing and doesn't need a
            // redundant save. Code-review patch: this commit now lives inside the same try block
            // as everything else in this job, so a failure here (e.g. a transient DB blip) is
            // covered by the identical retry-then-fail-closed handling below instead of leaving
            // the row stuck Queued forever with no compensating write.
            if (courseFile.Status == JobItemStatus.Queued)
            {
                courseFile.Status = JobItemStatus.Parsing;
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            await using var content = await fileStorage.OpenReadAsync(courseFile.StoredUrl, cancellationToken);
            var result = await documentParser.ParseAsync(content, courseFile.FileName, courseFile.ContentType, cancellationToken);

            if (result.IsSuccessful)
            {
                // No AI structuring step anymore -- a clean parse goes straight to Done, and its
                // raw ParsedContent is what the tutor/student actually see.
                courseFile.Status = JobItemStatus.Done;
                courseFile.ParsedContent = result.ParsedContent;
                courseFile.FailureReason = null;
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return;
            }

            // AC#2: a completed-but-low-confidence/failed parse routes to Failed, not a silent
            // pass-through.
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = Truncate(result.FailureReason ?? "Parsing failed.");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Code-review patch: structurally identical to ExtractStructureJob's malformed-response
            // branch (already wired) -- a genuine terminal failure with no exception object, since
            // this is a parsed-but-low-confidence result, not a thrown exception.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                Message = result.FailureReason ?? "Parsing failed.",
                Source = ErrorSource.Backend,
                OriginContext = nameof(ParseFileJob),
                RelatedEntityType = nameof(Domain.Courses.CourseFile),
                RelatedEntityId = courseFile.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Same generalized retry-then-fail-closed shape as ScanFileJob (Story 2.6) -- any
            // scan-time exception, not just DocumentParsingUnavailableException specifically.
            var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
            if (retryCount < MaxAttempts - 1)
                throw; // Let it propagate uncaught -- triggers Hangfire's automatic retry.

            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = Truncate(
                ex is DocumentParsingUnavailableException
                    ? "Parsing service unavailable — retries exhausted"
                    : $"Parsing failed — retries exhausted ({ex.GetType().Name})");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Story 4.3/FR-3/FR-4: mirrors the existing terminal write above, doesn't replace it.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = nameof(ParseFileJob),
                RelatedEntityType = nameof(Domain.Courses.CourseFile),
                RelatedEntityId = courseFile.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
    }

    private static string Truncate(string reason) =>
        reason.Length > MaxFailureReasonLength ? reason[..MaxFailureReasonLength] : reason;
}
