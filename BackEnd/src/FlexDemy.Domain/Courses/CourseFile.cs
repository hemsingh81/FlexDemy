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

    // Story 2.7: populated only on a successful, confidence-passing parse. Story 2.8's extraction
    // reads this once Status == Extracting.
    public string? ParsedContent { get; set; }

    // Story 2.8: a staged Chapter/Topic/Subtopic/ContentBlock proposal (raw JSON, no IDs, no
    // confirmation state -- see ExtractionResponseParser.ProposedStructure for the shape), set
    // only on a successful extraction (Status == Done). Story 2.9 materializes this into real
    // entities; this story does not write to those tables (they don't exist yet).
    public string? ExtractedStructureJson { get; set; }

    // Story 2.9/Task 6: flipped true the moment this file's staged ExtractedStructureJson has been
    // turned into real Chapter/Topic/Subtopic/ContentBlock rows, via an atomic conditional-UPDATE
    // claim in ContentTreeService.GetTreeAsync -- so a file's proposed structure is never
    // materialized twice. false is both the CLR default and the desired DB default (no analog to
    // Story 2.5's TagIds array-default omission risk).
    public bool IsMaterialized { get; set; }
}
