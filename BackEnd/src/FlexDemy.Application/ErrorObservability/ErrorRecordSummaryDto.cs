namespace FlexDemy.Application.ErrorObservability;

// AC #2's exact list-row field set. Category/Priority/Status/Source are ToString()'d PascalCase
// strings, matching CourseMapper.cs's own enum-serialization convention (there is no
// JsonStringEnumConverter configured anywhere in FlexDemy.Api -- see ContentTreeDtos.cs).
public sealed record ErrorRecordSummaryDto(
    string Id,
    string Category,
    string Priority,
    string Status,
    string Message,
    string Source,
    int OccurrenceCount,
    DateTimeOffset LastOccurredAt);
