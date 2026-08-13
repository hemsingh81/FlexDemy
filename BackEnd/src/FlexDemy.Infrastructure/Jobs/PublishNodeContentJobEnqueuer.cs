using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 3.8: thin wrapper around Hangfire's static BackgroundJob.Enqueue -- same shape as
// ExtractStructureJobEnqueuer (2.8).
public class PublishNodeContentJobEnqueuer : IPublishNodeContentJobEnqueuer
{
    public void Enqueue(string batchItemId) =>
        BackgroundJob.Enqueue<IPublishNodeContentJob>(j => j.RunAsync(batchItemId, CancellationToken.None, null));
}
