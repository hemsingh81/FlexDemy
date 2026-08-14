using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.6: the Hangfire job that runs the actual ClamAV scan, asynchronously after upload
// (AD-15's tab-close-safety guarantee). Registered AddScoped, like every other Infrastructure
// service -- Hangfire resolves job classes from the DI container per-execution.
public interface IScanFileJob
{
    // Story 4.1/AD-23: correlationId is forwarded by the enqueuer; RunAsync calls
    // ICorrelationIdAccessor.Set(correlationId) as its first action.
    Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null);
}
