using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.7: the Hangfire job that runs the Docling parsing pass after a file's malware scan
// passes. Registered AddScoped, like every other Infrastructure service.
public interface IParseFileJob
{
    // Story 4.1/AD-23: see IScanFileJob's own comment for why this parameter exists.
    Task RunAsync(string courseFileId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null);
}
