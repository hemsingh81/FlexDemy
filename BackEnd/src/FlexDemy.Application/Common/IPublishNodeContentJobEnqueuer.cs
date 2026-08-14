namespace FlexDemy.Application.Common;

// Story 3.8: same seam/reasoning as IExtractStructureJobEnqueuer (2.8) -- PublishService.PublishAsync
// needs to enqueue one IPublishNodeContentJob per confirmed node in a way that stays unit-testable
// with NSubstitute. The Infrastructure implementation still calls Hangfire's own
// BackgroundJob.Enqueue<IPublishNodeContentJob>(...) under the hood.
public interface IPublishNodeContentJobEnqueuer
{
    // Story 4.1/AD-23: see IScanFileJobEnqueuer's own header comment for why this parameter exists.
    void Enqueue(string batchItemId, string? correlationId);
}
