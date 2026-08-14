using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.6: thin wrapper around Hangfire's static BackgroundJob.Enqueue -- the standard
// fire-and-forget entry point (Task 5), not IBackgroundJobClient DI. See IScanFileJobEnqueuer's
// own header comment for why this seam exists at all.
public class ScanFileJobEnqueuer : IScanFileJobEnqueuer
{
    public void Enqueue(string courseFileId, string? correlationId) =>
        BackgroundJob.Enqueue<IScanFileJob>(j => j.RunAsync(courseFileId, correlationId, CancellationToken.None, null));
}
