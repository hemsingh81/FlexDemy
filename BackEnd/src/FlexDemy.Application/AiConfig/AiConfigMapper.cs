using FlexDemy.Domain.AiConfig;

namespace FlexDemy.Application.AiConfig;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper.
public static class AiConfigMapper
{
    // currentSpend: the mapper has no access to AiTaskBudget data -- the caller (AiConfigService,
    // which depends on IAiBudgetService) must pass in the real, live spend (Story 1.8, AD-18).
    public static AiTaskConfigDto ToDto(this AiTaskConfig entity, decimal currentSpend) => new(
        entity.TaskId,
        entity.Provider,
        entity.Model,
        entity.FallbackProvider,
        entity.FallbackModel,
        entity.BudgetThreshold,
        currentSpend,
        entity.PricePerMillionInputTokens,
        entity.PricePerMillionOutputTokens,
        entity.FallbackPricePerMillionInputTokens,
        entity.FallbackPricePerMillionOutputTokens
    );
}
