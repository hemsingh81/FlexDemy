using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.5/Task 1: one row per (node, LevelNumber) --
// TopicId/SubtopicId follow ContentBlock.TopicId/SubtopicId's exact mutual-exclusivity pattern
// (exactly one set, app-level invariant, see AdaptiveLearningService).
public class DrilldownLevel : AuditableEntity
{
    public string? TopicId { get; set; }
    public string? SubtopicId { get; set; }
    public int LevelNumber { get; set; }

    // Reuses Story 2.8's raw-JSON-storage precedent (CourseFile.ExtractedStructureJson) rather
    // than fully normalizing every nested field into columns. Shape:
    // { title, subtitle, content, keyPoints: string[], mathFormulas?: string[], examples: ExampleItem[] }
    // -- mirrors the frontend's DrillLevelData/ExampleItem shape (Story 3.1) so DTO mapping is a
    // straight pass-through. Null until first generated.
    public string? GeneratedContentJson { get; set; }

    // A tutor override -- always wins over GeneratedContentJson when present (AC#3), read/DTO-
    // mapping layer's job to enforce, not this entity's. Left untouched by generation, so
    // removing an override later falls back to the last real AI generation instead of needing to
    // regenerate. IsOverridden is deliberately NOT a stored column (ContentBlock's own precedent
    // for deriving state rather than storing a redundant flag) -- computed as
    // `OverrideContentJson is not null` wherever needed.
    public string? OverrideContentJson { get; set; }
}
