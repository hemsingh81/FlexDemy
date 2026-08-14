using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper.
public static class ErrorRecordMapper
{
    // List-row compactness only (AC #2) -- ToDetailDto below keeps the full value.
    private const int SummaryMessageMaxLength = 200;

    public static ErrorRecordSummaryDto ToSummaryDto(this ErrorRecord record) => new(
        record.Id,
        record.Category,
        record.Priority,
        record.Status,
        Truncate(record.Message, SummaryMessageMaxLength),
        record.Source,
        record.OccurrenceCount,
        record.LastOccurredAt);

    public static ErrorRecordDetailDto ToDetailDto(this ErrorRecord record) => new(
        record.Id,
        record.Category,
        record.Priority,
        record.Status,
        record.Message,
        record.Source,
        record.OccurrenceCount,
        record.LastOccurredAt,
        record.StackTrace,
        record.RequestPath,
        record.OriginContext,
        record.FirstOccurredAt,
        record.RelatedEntityType,
        record.RelatedEntityId,
        record.CorrelationId,
        record.ExceptionType);

    private static string Truncate(string message, int maxLength) =>
        message.Length > maxLength ? message[..maxLength] + "..." : message;
}
