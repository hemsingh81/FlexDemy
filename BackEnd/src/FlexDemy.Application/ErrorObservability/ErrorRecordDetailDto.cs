namespace FlexDemy.Application.ErrorObservability;

// AC #4's exact detail-view field set. Message is the full stored value here, not re-truncated
// to Summary's 200-char list-row cap -- AC #4 frames the whole detail view around "full
// untruncated" data (explicitly said for StackTrace; the same intent obviously applies to
// Message, or the detail view wouldn't actually show more than the list row does).
// Category/Priority/Status/Source are ToString()'d PascalCase strings -- see
// ErrorRecordSummaryDto's header comment for why.
public sealed record ErrorRecordDetailDto(
    string Id,
    string Category,
    string Priority,
    string Status,
    string Message,
    string Source,
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
