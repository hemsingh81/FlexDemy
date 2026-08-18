using FlexDemy.Domain.Common;
using FlexDemy.Domain.Jobs;

namespace FlexDemy.Domain.Courses;

// Story 8.1: AD-20's polymorphic OwnerType/OwnerId (same pattern as Page, Story 7.3) -- a
// Resource attaches to a Chapter, Topic, Sub-Topic, or Page, no DB FK, service-layer cascade only.
// Reuses JobItemStatus (CourseFile's own status enum) rather than inventing a second Queued/Done/
// Failed concept for the same idea -- a Resource only ever reaches Queued/Done/Failed, never
// Parsing (that's OCR-specific to CourseFile).
public class Resource : AuditableEntity
{
    public const int LabelMaxLength = 200;
    public const int CaptionMaxLength = 500;
    public const int FileNameMaxLength = 255;
    public const int FailureReasonMaxLength = 1024;

    public required ContentOwnerType OwnerType { get; set; }
    public required string OwnerId { get; set; }

    // Set when this resource was promoted from an already-uploaded, already-scanned CourseFile
    // (FR-37's "Attach existing file") -- the same bytes are never stored twice. Null for a
    // directly-uploaded resource. No FK (AD-20) -- Epic 10's FR-23 (deleting a source file warns
    // it will disappear from any page that attached it) needs this link to find which Resources
    // reference a given CourseFileId; it is not optional bookkeeping.
    public string? CourseFileId { get; set; }

    public required string Label { get; set; }
    public string? Caption { get; set; }
    public ResourceRole Role { get; set; } = ResourceRole.Attachment;

    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public required string StoredUrl { get; set; }
    public JobItemStatus Status { get; set; } = JobItemStatus.Queued;
    public string? FailureReason { get; set; }

    // Scoped to siblings sharing the same OwnerType+OwnerId (Story 7.2/7.3's own reorder
    // convention, reused verbatim).
    public int Order { get; set; }
}
