using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.8: the Hangfire job that runs AI structure extraction after a file's parse succeeds.
// Registered AddScoped, like every other Infrastructure service.
public interface IExtractStructureJob
{
    Task RunAsync(string courseFileId, CancellationToken cancellationToken, PerformContext? context = null);
}
