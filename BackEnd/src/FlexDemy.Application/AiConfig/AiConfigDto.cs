namespace FlexDemy.Application.AiConfig;

// CurrentSpend (Story 1.8): real, live spend from AiTaskBudget (AD-18), sourced via
// IAiBudgetService in AiConfigService -- defaults to 0m if no budget row exists for the task yet.
// PricePerMillion{Input,Output}Tokens (Story 1.7): read-only here -- deliberately absent from
// UpdateAiTaskConfigRequest below, since no UX design specifies an admin pricing-edit control yet.
public sealed record AiTaskConfigDto(
    string TaskId,
    string Provider,
    string Model,
    string FallbackProvider,
    string FallbackModel,
    decimal BudgetThreshold,
    decimal CurrentSpend,
    decimal PricePerMillionInputTokens,
    decimal PricePerMillionOutputTokens,
    decimal FallbackPricePerMillionInputTokens,
    decimal FallbackPricePerMillionOutputTokens);

public sealed record UpdateAiTaskConfigRequest(
    string Provider,
    string Model,
    string FallbackProvider,
    string FallbackModel,
    decimal BudgetThreshold);
