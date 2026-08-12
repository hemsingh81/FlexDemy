using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.6: the Hangfire job that runs the actual ClamAV scan, asynchronously after upload
// (AD-15's tab-close-safety guarantee). Registered AddScoped, like every other Infrastructure
// service -- Hangfire resolves job classes from the DI container per-execution.
public interface IScanFileJob
{
    Task RunAsync(string courseFileId, CancellationToken cancellationToken, PerformContext? context = null);
}
