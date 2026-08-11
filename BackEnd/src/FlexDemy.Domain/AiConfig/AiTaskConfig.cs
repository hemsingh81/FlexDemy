using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.AiConfig;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/AiTaskConfigConfiguration.cs. One row per AI Task
// (AiTaskIds), unique on TaskId. Id/CreatedAt/etc. come from AuditableEntity (AD-19).
public class AiTaskConfig : AuditableEntity
{
    public required string TaskId { get; set; }
    public required string Provider { get; set; }
    public required string Model { get; set; }
    public required string FallbackProvider { get; set; }
    public required string FallbackModel { get; set; }
    public decimal BudgetThreshold { get; set; }
    // Story 1.7: separate price pairs for the primary and fallback provider -- the two are
    // frequently different tiers in practice (e.g. a free-tier primary with a paid fallback), so a
    // single shared price pair would misreport cost for every fallback-served call (review
    // finding, 2026-08-11: the original single-pair design was corrected before this story closed).
    public decimal PricePerMillionInputTokens { get; set; }
    public decimal PricePerMillionOutputTokens { get; set; }
    public decimal FallbackPricePerMillionInputTokens { get; set; }
    public decimal FallbackPricePerMillionOutputTokens { get; set; }
}
