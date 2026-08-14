using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 3.8: the Hangfire job that pre-generates Drill-Down/Ways content for one confirmed node
// at publish time. Registered AddScoped, like every other Infrastructure service.
public interface IPublishNodeContentJob
{
    // Story 4.1/AD-23: see IScanFileJob's own comment for why this parameter exists.
    Task RunAsync(string batchItemId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null);
}
