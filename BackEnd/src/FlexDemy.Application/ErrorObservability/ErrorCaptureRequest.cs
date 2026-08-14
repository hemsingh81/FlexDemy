using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// The single request shape every capture site (Story 4.3's middleware/job sites, Story 4.4's
// frontend-reporting endpoint) builds and passes to IErrorCaptureService.CaptureAsync.
public sealed record ErrorCaptureRequest
{
    public string? ExceptionType { get; init; }
    public required string Message { get; init; }
    public string? StackTrace { get; init; }
    public ErrorSource Source { get; init; }
    public string? OriginContext { get; init; }
    public string? RelatedEntityType { get; init; }
    public string? RelatedEntityId { get; init; }
    public string? UserId { get; init; }
    public string? RequestPath { get; init; }

    // Task 5's structured redaction pass -- deny-listed key/value context pairs.
    public IReadOnlyDictionary<string, string>? Context { get; init; }

    // Task 3's SecondaryCategory trigger -- true only for Story 4.3's job-terminal-failure sites.
    public bool IsBackgroundJobFailure { get; init; }

    // Story 4.4's anonymous frontend-reporting endpoint passes the frontend's own stored
    // Correlation ID here; every other capture site omits this and gets the correct ambient
    // ICorrelationIdAccessor.Current value instead. See ErrorCaptureService for the resolution.
    public string? CorrelationIdOverride { get; init; }
}
