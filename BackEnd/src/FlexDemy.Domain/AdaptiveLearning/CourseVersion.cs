using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.8/Task 4: AD-17's version snapshot -- a deep-copy of
// the confirmed content tree plus every generated/overridden DrilldownLevel/WayContent row for
// the course, serialized once at publish-batch-completion time. Story 3.10 (written after this
// one) adds retrieval/restore capability on top of this same entity -- it does not change how/
// when a snapshot is created. No stated retention-count bound (backend spine's own Deferred
// section flags this explicitly as undecided): one row per successful publish, no pruning.
public class CourseVersion : AuditableEntity
{
    public required string CourseId { get; set; }
    public required string SnapshotJson { get; set; }
    public DateTimeOffset PublishedAt { get; set; }
}
