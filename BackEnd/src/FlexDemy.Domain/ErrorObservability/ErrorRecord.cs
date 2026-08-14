using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.ErrorObservability;

// Persistence-ignorant POCO (AD-4), matching CourseFile's pattern. One row per distinct
// Fingerprint (FR-8) -- a repeat occurrence increments OccurrenceCount/LastOccurredAt on the same
// row rather than inserting a new one, or triggers Reopen (FR-16) if the row was Resolved/Archived.
public class ErrorRecord : AuditableEntity
{
    public required string Fingerprint { get; set; }
    public ErrorSource Source { get; set; }
    public ErrorCategory Category { get; set; }

    // FR-9's "Background Job" cross-cutting tag -- set alongside Category (never in place of it)
    // when the failure originates from a Hangfire job's terminal failure (Story 4.3).
    public ErrorCategory? SecondaryCategory { get; set; }

    public ErrorPriority Priority { get; set; }
    public ErrorStatus Status { get; set; } = ErrorStatus.New;

    public required string Message { get; set; }
    public string? ExceptionType { get; set; }
    public string? StackTrace { get; set; }
    public string? OriginContext { get; set; }

    // FR-4: points back to the originating CourseFile/PublishBatchItem row when this ErrorRecord
    // mirrors an existing per-entity failure field.
    public string? RelatedEntityType { get; set; }
    public string? RelatedEntityId { get; set; }

    public string? UserId { get; set; }
    public string? RequestPath { get; set; }

    // FR-22: the Correlation ID active at the moment of failure (Story 4.1's ICorrelationIdAccessor,
    // or an explicit CorrelationIdOverride for the anonymous frontend-reporting path, Story 4.4).
    public string? CorrelationId { get; set; }

    public int OccurrenceCount { get; set; } = 1;
    public DateTimeOffset FirstOccurredAt { get; set; }
    public DateTimeOffset LastOccurredAt { get; set; }

    // FR-16: preserves only the most-recent dismissal info, not a full history -- overwritten on
    // each Resolve/Archive cycle.
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolvedByUserId { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }

    // FR-17: set by a manual Increase Priority action (Story 4.6) -- overwrites any prior
    // increase's attribution, same single-most-recent-event convention as ResolvedAt/ArchivedAt.
    public DateTimeOffset? PriorityIncreasedAt { get; set; }
    public string? PriorityIncreasedByUserId { get; set; }
}
