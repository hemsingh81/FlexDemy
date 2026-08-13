using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.8/Task 1: one row per node covered by a publish batch
// -- TopicId?/SubtopicId? follow ContentBlock's exact mutual-exclusivity pattern (Chapters and
// ContentBlocks are never batch items, matching this epic's confirmed-node-scope rule). ProgressText
// is free text (e.g. "Generating Way 3 of 5…"), matching Story 3.4's ChecklistRow.statusText shape
// exactly so the real checklist API needs no reshaping.
public class PublishBatchItem : AuditableEntity
{
    public required string BatchId { get; set; }
    public string? TopicId { get; set; }
    public string? SubtopicId { get; set; }
    public PublishItemStatus Status { get; set; } = PublishItemStatus.Queued;
    public string? ProgressText { get; set; }

    // Code-review patch: tracks whether this item's one-time atomic decrement of
    // PublishBatch.Remaining has already been claimed -- independent of Status, because Status
    // alone is not a safe idempotency signal for the decrement (Status becomes terminal BEFORE
    // the decrement runs; if the decrement or the finalize step that follows it then throws, a
    // Hangfire retry must still be able to tell "have I already counted toward Remaining" apart
    // from "has generation already completed"). Set atomically together with the decrement itself
    // in one SQL statement (PublishBatchRepository.DecrementRemainingAsync) -- never set from C#.
    public bool DecrementCommitted { get; set; }
}
