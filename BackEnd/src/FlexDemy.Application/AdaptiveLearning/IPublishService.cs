namespace FlexDemy.Application.AdaptiveLearning;

public interface IPublishService
{
    // Tutor-facing trigger. Requires LifecycleState == ReviewConfirmed. Creates the PublishBatch
    // row and one PublishBatchItem per confirmed Topic/Subtopic, enqueues one
    // PublishNodeContentJob per item, then returns immediately -- the batch itself runs async.
    Task PublishAsync(string courseId, CancellationToken cancellationToken = default);

    // Student/tutor-facing read of the current (or most recent) publish batch's progress, shaped
    // to match Story 3.4's ChecklistRow contract exactly.
    Task<PublishStatusDto> GetStatusAsync(string courseId, CancellationToken cancellationToken = default);
}
