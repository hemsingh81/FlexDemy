using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AdaptiveLearning;

// Persistence-ignorant POCO (AD-4). Story 3.5/Task 1: one row per (node, WayNumber) -- same
// TopicId?/SubtopicId? mutual-exclusivity pattern as DrilldownLevel/ContentBlock.
public class WayContent : AuditableEntity
{
    public string? TopicId { get; set; }
    public string? SubtopicId { get; set; }
    public int WayNumber { get; set; }

    // Shape: { explanation: string, example: ExampleItem } -- mirrors the frontend's WayData
    // shape (Story 3.2). Null until first generated.
    public string? GeneratedContentJson { get; set; }

    // Same override-always-wins semantics as DrilldownLevel.OverrideContentJson.
    public string? OverrideContentJson { get; set; }
}
