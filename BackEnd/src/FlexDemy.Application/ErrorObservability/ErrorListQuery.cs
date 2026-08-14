using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// Story 4.5: bound directly from ErrorsController's [FromQuery] parameters (standard ASP.NET
// Core model binding for nullable enums/dates -- no custom binder needed).
public sealed record ErrorListQuery
{
    public ErrorCategory? Category { get; init; }
    public ErrorPriority? Priority { get; init; }
    public ErrorStatus? Status { get; init; }
    public ErrorSource? Source { get; init; }

    // Matched against LastOccurredAt (AC #3).
    public DateTimeOffset? FromDate { get; init; }
    public DateTimeOffset? ToDate { get; init; }

    // Matched against Message/ExceptionType (AC #3's free-text filter).
    public string? Search { get; init; }

    // Story 4.7/AC #2: exact match only, unlike Search above -- clicking a Correlation ID (or
    // typing one into the filter panel) must show exactly the records sharing that one trace,
    // not every record whose CorrelationId happens to contain it as a substring.
    public string? CorrelationId { get; init; }

    // AC #3: default off -- Archived records are excluded unless explicitly requested.
    public bool IncludeArchived { get; init; }

    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}
