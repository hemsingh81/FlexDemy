using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 8.1: mirrors ScanFileJobEnqueuer exactly.
public class ScanResourceJobEnqueuer : IScanResourceJobEnqueuer
{
    public void Enqueue(string resourceId, string? correlationId) =>
        BackgroundJob.Enqueue<IScanResourceJob>(j => j.RunAsync(resourceId, correlationId, CancellationToken.None, null));
}
