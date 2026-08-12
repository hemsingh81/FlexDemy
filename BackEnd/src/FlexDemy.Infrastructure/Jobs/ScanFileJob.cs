using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Jobs;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

public class ScanFileJob(
    ICourseFileRepository repository,
    IUnitOfWork unitOfWork,
    IFileStorageService fileStorage,
    IFileScanner fileScanner,
    IParseFileJobEnqueuer parseFileJobEnqueuer) : IScanFileJob
{
    // Matches [AutomaticRetry(Attempts = MaxAttempts)] below -- kept as a named constant so the
    // retry-exhaustion check (RunAsync) can't silently drift out of sync with the attribute.
    private const int MaxAttempts = 5;

    // Matches the course_files.failure_reason column's HasMaxLength(1024) (code-review patch).
    private const int MaxFailureReasonLength = 1024;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string courseFileId, CancellationToken cancellationToken, PerformContext? context = null)
    {
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
                    parseFileJobEnqueuer.Enqueue(courseFile.Id);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    courseFile.Status = JobItemStatus.Failed;
                    courseFile.FailureReason = Truncate($"Could not schedule parsing: {ex.Message}");
                    await unitOfWork.SaveChangesAsync(cancellationToken);
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
        }
    }

    // Code-review patch: ClamAV's own reported threat name is out of this codebase's control --
    // guard against it (or the generic exception message) exceeding the column's max length and
    // throwing an unhandled DbUpdateException at SaveChangesAsync.
    private static string Truncate(string reason) =>
        reason.Length > MaxFailureReasonLength ? reason[..MaxFailureReasonLength] : reason;
}
