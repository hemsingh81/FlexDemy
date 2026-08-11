using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AiConfig;

// Persistence-ignorant POCO (AD-4). Versioned prompt text per AI Task (AD-19) -- one seeded row
// per AiTaskIds entry in this story; no service/endpoint reads or writes it yet (see Story 1.5's
// Dev Notes -- nothing needs to edit prompt text until a later story). Unique on (TaskId, Version).
public class AiPromptVersion : AuditableEntity
{
    public required string TaskId { get; set; }
    public int Version { get; set; }
    public required string PromptText { get; set; }
    public bool IsPromptActive { get; set; }
}
