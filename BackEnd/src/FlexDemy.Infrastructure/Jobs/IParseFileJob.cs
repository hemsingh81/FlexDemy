using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.7: the Hangfire job that runs the Docling parsing pass after a file's malware scan
// passes. Registered AddScoped, like every other Infrastructure service.
public interface IParseFileJob
{
    Task RunAsync(string courseFileId, CancellationToken cancellationToken, PerformContext? context = null);
}
