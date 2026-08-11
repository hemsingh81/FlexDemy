using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AiUsage;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/AiTaskBudgetConfiguration.cs. One row per AI Task
// (AiTaskIds), unique on TaskId -- mirrors AiTaskConfig's one-row-per-task shape, not
// AiTaskUsage's many-rows-per-task shape. Holds only Spent, never a copy of the threshold
// (AD-18) -- the threshold is always read live from AiTaskConfig.BudgetThreshold, never
// duplicated here, so the two can never drift apart.
public class AiTaskBudget : AuditableEntity
{
    public required string TaskId { get; set; }
    public decimal Spent { get; set; }
}
