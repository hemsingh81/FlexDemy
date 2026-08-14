using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.Jobs;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

public class ScanFileJob(
    ICourseFileRepository repository,
    IUnitOfWork unitOfWork,
    IFileStorageService fileStorage,
    IFileScanner fileScanner,
    IParseFileJobEnqueuer parseFileJobEnqueuer,
    ICorrelationIdAccessor correlationIdAccessor,
    IErrorCaptureService errorCaptureService) : IScanFileJob
{
    // Matches [AutomaticRetry(Attempts = MaxAttempts)] below -- kept as a named constant so the
    // retry-exhaustion check (RunAsync) can't silently drift out of sync with the attribute.
    private const int MaxAttempts = 5;

    // Matches the course_files.failure_reason column's HasMaxLength(1024) (code-review patch).
    private const int MaxFailureReasonLength = 1024;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)
    {
        // Story 4.1/AD-23: first line, so every downstream capture call within this job's
        // execution picks up the same Correlation ID as the enqueuing HTTP request -- the job
        // runs on a separate thread with no relationship to that request's own async-flow context,
        // so this must be set explicitly here rather than assumed to already be ambient.
        correlationIdAccessor.Set(correlationId);

        var courseFile = await repository.GetByIdAsync(courseFileId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.CourseFile), courseFileId);

        // Code-review patch (idempotency guard): a retried/replayed execution of an already
        // terminal row (e.g. a prior attempt saved Status=Failed but then threw before this
        // method returned) must not re-scan or re-delete an already-handled file.
        if (courseFile.Status != JobItemStatus.Queued)
            return;

        try
        {
            await using var content = await fileStorage.OpenReadAsync(courseFile.StoredUrl, cancellationToken);
            var scanResult = await fileScanner.ScanAsync(content, cancellationToken);

            if (!scanResult.IsClean)
            {
                // Code-review patch: persist the DB status change BEFORE deleting the stored
                // file, not after -- if SaveChangesAsync throws, the row must not be left
                // Queued while the file backing it is already gone (which would then make the
                // next retry's OpenReadAsync throw FileNotFoundException).
                courseFile.Status = JobItemStatus.Failed;
                courseFile.FailureReason = Truncate($"Malware detected: {scanResult.ThreatName}");
                await unitOfWork.SaveChangesAsync(cancellationToken);
                // A detected-malicious file must not remain on disk.
                await fileStorage.DeleteAsync(courseFile.StoredUrl, cancellationToken);

                // Code-review patch: a genuine terminal Failed write with no exception object --
                // still a capturable failure per FR-1's spirit, same as the malformed-response
                // branches wired elsewhere in this epic.
                await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
                {
                    Message = $"Malware detected: {scanResult.ThreatName}",
                    Source = ErrorSource.Backend,
                    OriginContext = nameof(ScanFileJob),
                    RelatedEntityType = nameof(Domain.Courses.CourseFile),
                    RelatedEntityId = courseFile.Id,
                    IsBackgroundJobFailure = true,
                }, cancellationToken);
            }
            else
            {
                // Story 2.7: Status stays Queued (already set at upload time) -- the file is now
                // genuinely ready for parsing. Chains straight into ParseFileJob so a file that
                // passes malware scanning proceeds automatically, no new user action or endpoint
                // needed -- one background job per pipeline step, chained on success (AD-15).
                //
                // Code-review patch: this call is deliberately its own try/catch, not left inside
                // the outer one -- an enqueue failure here means the scan itself succeeded and
                // only scheduling the next step failed; without this, the outer catch's generic
                // "Scan failed" message would mislabel a clean scan as a scan failure. Mirrors
                // CourseFileService.UploadFileAsync's identical enqueue-failure compensation for
                // the scan job itself.
                try
                {
                    parseFileJobEnqueuer.Enqueue(courseFile.Id, correlationId);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    courseFile.Status = JobItemStatus.Failed;
                    courseFile.FailureReason = Truncate($"Could not schedule parsing: {ex.Message}");
                    await unitOfWork.SaveChangesAsync(cancellationToken);

                    // Code-review patch: a Hangfire enqueue failure is exactly the backend
                    // infrastructure failure this epic exists to surface.
                    await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
                    {
                        ExceptionType = ex.GetType().Name,
                        Message = ex.Message,
                        StackTrace = ex.StackTrace,
                        Source = ErrorSource.Backend,
                        OriginContext = nameof(ScanFileJob),
                        RelatedEntityType = nameof(Domain.Courses.CourseFile),
                        RelatedEntityId = courseFile.Id,
                        IsBackgroundJobFailure = true,
                    }, cancellationToken);
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Code-review patch: originally only caught FileScanUnavailableException -- any other
            // exception (a raw FileNotFoundException from OpenReadAsync, an unexpected scanner
            // bug, etc.) used to propagate uncaught, burn all of Hangfire's retries pointlessly,
            // and leave the row stuck at Queued forever with no compensating write. AC#3's
            // fail-closed guarantee is generalized here to any scan-time failure, not just
            // scanner-unavailability specifically.
            var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
            if (retryCount < MaxAttempts - 1)
                throw; // Let it propagate uncaught -- triggers Hangfire's automatic retry.

            // AC#3, fail-closed: retries are exhausted and the scan never completed -- the row
            // must not stay Queued forever while genuinely unscanned. Caught here (not rethrown)
            // so Hangfire's own job doesn't need a 6th attempt just to run this cleanup.
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = Truncate(
                ex is FileScanUnavailableException
                    ? "Scanning unavailable — retries exhausted"
                    : $"Scan failed — retries exhausted ({ex.GetType().Name})");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // Story 4.3/FR-3/FR-4: mirrors the existing terminal write above, doesn't replace it.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = nameof(ScanFileJob),
                RelatedEntityType = nameof(Domain.Courses.CourseFile),
                RelatedEntityId = courseFile.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
    }

    // Code-review patch: ClamAV's own reported threat name is out of this codebase's control --
    // guard against it (or the generic exception message) exceeding the column's max length and
    // throwing an unhandled DbUpdateException at SaveChangesAsync.
    private static string Truncate(string reason) =>
        reason.Length > MaxFailureReasonLength ? reason[..MaxFailureReasonLength] : reason;
}
