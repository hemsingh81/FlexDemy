using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// AC #2's exact list-row field set.
public sealed record ErrorRecordSummaryDto(
    string Id,
    ErrorCategory Category,
    ErrorPriority Priority,
    ErrorStatus Status,
    string Message,
    ErrorSource Source,
    int OccurrenceCount,
    DateTimeOffset LastOccurredAt);
