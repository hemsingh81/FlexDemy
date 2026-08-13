using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.7/Task 1: a request-time cache-after-first-generation
// row per (CourseId, NormalizedKeyword) -- unique index scoped PER-COURSE, not global, so the
// same keyword in two different courses is simply two different rows, never sharing a cache entry
// (AC#3, by construction).
public class KeywordDefinition : AuditableEntity
{
    public required string CourseId { get; set; }
    // Original-cased keyword as first requested -- display-only, never the lookup key.
    public required string Keyword { get; set; }
    // Lowercase/trimmed -- the real lookup key.
    public required string NormalizedKeyword { get; set; }

    // Same GeneratedDefinitionText/OverrideDefinitionText two-column shape Story 3.5 established
    // for DrilldownLevel/WayContent -- override always wins when present (AC#2), read/DTO-mapping
    // layer's job to enforce.
    public string? GeneratedDefinitionText { get; set; }
    public string? OverrideDefinitionText { get; set; }
}
