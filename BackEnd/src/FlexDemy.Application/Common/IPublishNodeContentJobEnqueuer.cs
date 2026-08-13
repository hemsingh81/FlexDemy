namespace FlexDemy.Application.Common;

// Story 3.8: same seam/reasoning as IExtractStructureJobEnqueuer (2.8) -- PublishService.PublishAsync
// needs to enqueue one IPublishNodeContentJob per confirmed node in a way that stays unit-testable
// with NSubstitute. The Infrastructure implementation still calls Hangfire's own
// BackgroundJob.Enqueue<IPublishNodeContentJob>(...) under the hood.
public interface IPublishNodeContentJobEnqueuer
{
    void Enqueue(string batchItemId);
}
