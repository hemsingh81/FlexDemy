using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AiUsage;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/AiTaskUsageConfiguration.cs. One row per successful
// AI Task invocation (Story 1.7) -- a failed invocation (both primary and fallback failed) writes
// no row, since there is no token usage to record. CreatedAt (from AuditableEntity) is the
// invocation timestamp -- no separate date/timestamp field.
public class AiTaskUsage : AuditableEntity
{
    public required string TaskId { get; set; }
    public required string Provider { get; set; }
    public required string Model { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public decimal Cost { get; set; }
    public bool IsFallbackServed { get; set; }
    // CourseId/TutorId (Story 1.7): nullable -- "where applicable" per FR-4. Always null today,
    // since no Epic 1 caller supplies real course/tutor context yet (see Story 1.7 Dev Notes).
    public string? CourseId { get; set; }
    public string? TutorId { get; set; }
}
