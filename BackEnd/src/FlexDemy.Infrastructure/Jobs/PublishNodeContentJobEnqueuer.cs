using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 3.8: thin wrapper around Hangfire's static BackgroundJob.Enqueue -- same shape as
// ExtractStructureJobEnqueuer (2.8).
public class PublishNodeContentJobEnqueuer : IPublishNodeContentJobEnqueuer
{
    public void Enqueue(string batchItemId, string? correlationId) =>
        BackgroundJob.Enqueue<IPublishNodeContentJob>(j => j.RunAsync(batchItemId, correlationId, CancellationToken.None, null));
}
