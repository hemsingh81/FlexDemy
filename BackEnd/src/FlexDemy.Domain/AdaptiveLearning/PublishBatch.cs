using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.8/Task 1: AD-16's atomic-counter batch-completion
// mechanism, built for the first time here -- no PublishBatch/batch-of-any-kind entity existed
// anywhere in this codebase before this story. Remaining starts equal to TotalNodes and is
// decremented atomically, exactly once per PublishBatchItem reaching a terminal status
// (PublishBatchRepository.TryDecrementRemainingAsync) -- never via a plain EF-tracked
// read-then-write, which would reopen the exact race AD-16 exists to prevent.
public class PublishBatch : AuditableEntity
{
    public required string CourseId { get; set; }
    public int TotalNodes { get; set; }
    public int Remaining { get; set; }
}
