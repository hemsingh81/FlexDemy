using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// AC #4's exact detail-view field set. Message is the full stored value here, not re-truncated
// to Summary's 200-char list-row cap -- AC #4 frames the whole detail view around "full
// untruncated" data (explicitly said for StackTrace; the same intent obviously applies to
// Message, or the detail view wouldn't actually show more than the list row does).
public sealed record ErrorRecordDetailDto(
    string Id,
    ErrorCategory Category,
    ErrorPriority Priority,
    ErrorStatus Status,
    string Message,
    ErrorSource Source,
    int OccurrenceCount,
    DateTimeOffset LastOccurredAt,
    string? StackTrace,
    string? RequestPath,
    string? OriginContext,
    DateTimeOffset FirstOccurredAt,
    string? RelatedEntityType,
    string? RelatedEntityId,
    string? CorrelationId,
    string? ExceptionType);
