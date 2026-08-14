using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.8: the Hangfire job that runs AI structure extraction after a file's parse succeeds.
// Registered AddScoped, like every other Infrastructure service.
public interface IExtractStructureJob
{
    // Story 4.1/AD-23: see IScanFileJob's own comment for why this parameter exists.
    Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null);
}
