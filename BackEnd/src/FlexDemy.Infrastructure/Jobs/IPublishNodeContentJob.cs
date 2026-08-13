using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 3.8: the Hangfire job that pre-generates Drill-Down/Ways content for one confirmed node
// at publish time. Registered AddScoped, like every other Infrastructure service.
public interface IPublishNodeContentJob
{
    Task RunAsync(string batchItemId, CancellationToken cancellationToken, PerformContext? context = null);
}
