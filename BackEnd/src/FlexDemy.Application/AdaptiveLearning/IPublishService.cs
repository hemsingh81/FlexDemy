namespace FlexDemy.Application.AdaptiveLearning;

public interface IPublishService
{
    // Tutor-facing trigger. Requires LifecycleState == ReviewConfirmed; snapshots the course's
    // current file content (IVersionService) then transitions straight to Published.
    Task PublishAsync(string courseId, CancellationToken cancellationToken = default);

    // Read of the course's current lifecycle state.
    Task<PublishStatusDto> GetStatusAsync(string courseId, CancellationToken cancellationToken = default);
}
