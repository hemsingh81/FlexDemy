using FlexDemy.Domain.Common;
using FlexDemy.Domain.Jobs;

namespace FlexDemy.Domain.Courses;

// Persistence-ignorant POCO (AD-4). Unlike CourseThumbnail, this is an AuditableEntity -- it
// needs its own audit trail (who uploaded it and when). No ParsedText/extraction fields --
// Stories 2.7/2.8 add exactly what they need via their own migrations.
public class CourseFile : AuditableEntity
{
    public required string CourseId { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public required string StoredUrl { get; set; }
    public JobItemStatus Status { get; set; } = JobItemStatus.Queued;
    public string? FailureReason { get; set; }

    // Populated once Docling parsing succeeds (Status == Done) -- the raw text shown directly to
    // the tutor/student, with no AI structuring step in between.
    public string? ParsedContent { get; set; }
}
