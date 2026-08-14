namespace FlexDemy.Application.ErrorObservability;

// AD-24: the single entry point every capture site (Story 4.3's middleware/job sites, Story 4.4's
// frontend-reporting endpoint) calls -- owns fingerprinting, categorization, and priority
// assignment in one place so none of those sites reimplements the logic.
public interface IErrorCaptureService
{
    Task CaptureAsync(ErrorCaptureRequest request, CancellationToken cancellationToken = default);
}
