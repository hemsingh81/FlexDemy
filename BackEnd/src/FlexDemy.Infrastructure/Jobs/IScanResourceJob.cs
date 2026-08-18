using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 8.1: mirrors IScanFileJob exactly.
public interface IScanResourceJob
{
    Task RunAsync(string resourceId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null);
}
