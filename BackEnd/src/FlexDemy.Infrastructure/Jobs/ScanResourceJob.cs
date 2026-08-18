using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.Jobs;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 8.1: mirrors ScanFileJob's structure (idempotency guard, fail-closed retry-exhaustion
// handling, ErrorCaptureService reporting) but its terminal step after a clean scan is NOT
// ParseFileJob (that job's OCR/structure-extraction has no meaning for a Resource) -- it's the
// new SVG-sanitization step (image/svg+xml only), then Status = Done. Every other content type
// goes straight to Done after a clean scan.
public class ScanResourceJob(
    IContentRepository repository,
    IUnitOfWork unitOfWork,
    IFileStorageService fileStorage,
    IFileScanner fileScanner,
    ISvgSanitizer svgSanitizer,
    ICorrelationIdAccessor correlationIdAccessor,
    IErrorCaptureService errorCaptureService) : IScanResourceJob
{
    private const int MaxAttempts = 5;
    private const int MaxFailureReasonLength = Domain.Courses.Resource.FailureReasonMaxLength;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string resourceId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)
    {
        correlationIdAccessor.Set(correlationId);

        var resource = await repository.GetResourceByIdAsync(resourceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.Resource), resourceId);

        // Idempotency guard -- a retried/replayed execution of an already-terminal row must not
        // re-scan or re-delete an already-handled resource.
        if (resource.Status != JobItemStatus.Queued)
            return;

        try
        {
            await using (var content = await fileStorage.OpenReadAsync(resource.StoredUrl, cancellationToken))
            {
                var scanResult = await fileScanner.ScanAsync(content, cancellationToken);

                if (!scanResult.IsClean)
                {
                    resource.Status = JobItemStatus.Failed;
                    resource.FailureReason = Truncate($"Malware detected: {scanResult.ThreatName}");
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    await fileStorage.DeleteAsync(resource.StoredUrl, cancellationToken);

                    await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
                    {
                        Message = $"Malware detected: {scanResult.ThreatName}",
                        Source = ErrorSource.Backend,
                        OriginContext = nameof(ScanResourceJob),
                        RelatedEntityType = nameof(Domain.Courses.Resource),
                        RelatedEntityId = resource.Id,
                        IsBackgroundJobFailure = true,
                    }, cancellationToken);
                    return;
                }
            }

            // Story 8.1/AD-28: SVG sanitization runs only for image/svg+xml, immediately after a
            // clean scan and before Status flips to Done. Rewrites the stored bytes in place
            // (re-saved via IFileStorageService, overwriting the unsanitized upload) rather than
            // rejecting the upload outright -- unless the content isn't parseable as SVG at all,
            // which is treated as a scan-style failure, not an unhandled exception.
            if (string.Equals(resource.ContentType, "image/svg+xml", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await using var original = await fileStorage.OpenReadAsync(resource.StoredUrl, cancellationToken);
                    await using var sanitized = await svgSanitizer.SanitizeAsync(original, cancellationToken);
                    await fileStorage.SaveAsync(sanitized, StoredFileName(resource.StoredUrl), resource.ContentType, category: "course-resources", cancellationToken);
                }
                catch (SvgSanitizationException ex)
                {
                    resource.Status = JobItemStatus.Failed;
                    resource.FailureReason = Truncate(ex.Message);
                    await unitOfWork.SaveChangesAsync(cancellationToken);

                    await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
                    {
                        ExceptionType = ex.GetType().Name,
                        Message = ex.Message,
                        Source = ErrorSource.Backend,
                        OriginContext = nameof(ScanResourceJob),
                        RelatedEntityType = nameof(Domain.Courses.Resource),
                        RelatedEntityId = resource.Id,
                        IsBackgroundJobFailure = true,
                    }, cancellationToken);
                    return;
                }
            }

            resource.Status = JobItemStatus.Done;
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
            if (retryCount < MaxAttempts - 1)
                throw; // Let it propagate uncaught -- triggers Hangfire's automatic retry.

            resource.Status = JobItemStatus.Failed;
            resource.FailureReason = Truncate(
                ex is FileScanUnavailableException
                    ? "Scanning unavailable — retries exhausted"
                    : $"Scan failed — retries exhausted ({ex.GetType().Name})");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = nameof(ScanResourceJob),
                RelatedEntityType = nameof(Domain.Courses.Resource),
                RelatedEntityId = resource.Id,
                IsBackgroundJobFailure = true,
            }, cancellationToken);
        }
    }

    // The sanitized SVG is re-saved under the same file name it was originally stored with, so
    // StoredUrl never needs to change -- only the bytes at that path do.
    private static string StoredFileName(string storedUrl) => Path.GetFileName(storedUrl);

    private static string Truncate(string reason) =>
        reason.Length > MaxFailureReasonLength ? reason[..MaxFailureReasonLength] : reason;
}
