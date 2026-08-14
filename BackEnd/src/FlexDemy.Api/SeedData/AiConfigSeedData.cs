using FlexDemy.Domain.AiConfig;

namespace FlexDemy.Api.SeedData;

// Dev-only seed values -- mirrors FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts's
// MOCK_AI_TASK_CONFIGS exactly (Story 1.1), so an admin sees identical values on first real load
// (Story 1.5 AC #3). Every non-embeddings task defaults to Groq; embeddings defaults to Local --
// both satisfy PRD NFR5 (dev-phase providers that do not train on input by default).
public static class AiConfigSeedData
{
    // PricePerMillion{Input,Output}Tokens: 0m/0m for every task -- every seeded primary provider
    // (Groq, Local) is genuinely free-tier, so $0.00 computed cost is the accurate number, not a
    // placeholder (Story 1.7 Dev Notes). FallbackPricePerMillion{Input,Output}Tokens: also 0m, but
    // this IS a placeholder -- every seeded fallback provider is OpenRouter, a real paid API, not
    // free-tier. Left at 0 (not a guessed rate) until an admin sets real pricing once a pricing-edit
    // UI exists (deferred-work.md); a fallback-served call is under-reported until then, a known,
    // documented gap rather than a fabricated number (review finding, 2026-08-11).
    public record TaskConfigSeed(
        string TaskId, string Provider, string Model, string FallbackProvider, string FallbackModel, decimal BudgetThreshold,
        decimal PricePerMillionInputTokens = 0m, decimal PricePerMillionOutputTokens = 0m,
        decimal FallbackPricePerMillionInputTokens = 0m, decimal FallbackPricePerMillionOutputTokens = 0m);

    // Model IDs: "llama-4-scout"/"llama-4-maverick" (bare or the full
    // meta-llama/llama-4-{scout,maverick}-...-instruct path -- tried both) are NOT valid Groq
    // model IDs on this account -- confirmed live, 2026-08-14, both against Groq's real
    // /openai/v1/chat/completions (404 "model_not_found") and its /openai/v1/models catalog
    // (neither Llama 4 variant listed at all; only llama-3.3-70b-versatile/llama-3.1-8b-instant
    // among general-purpose chat models). Every task that was on a Llama 4 variant now uses
    // llama-3.3-70b-versatile instead -- Groq's largest/most capable model this account actually
    // has access to. This was masked for a while by an unrelated TLS-inspection outage that
    // failed every AI call before the request ever got a real response to react to -- re-verify
    // against /openai/v1/models if Groq later grants this account access to a Llama 4 model and
    // a bigger model becomes preferable for extractStructure/explainTopic specifically.
    public static readonly IReadOnlyList<TaskConfigSeed> TaskConfigs =
    [
        new(AiTaskIds.ExtractStructure, "Groq", "llama-3.3-70b-versatile", "OpenRouter", "gpt-4o-mini", 50m),
        new(AiTaskIds.ExplainTopic, "Groq", "llama-3.3-70b-versatile", "OpenRouter", "claude-4-haiku", 80m),
        new(AiTaskIds.RewriteExplanation, "Groq", "llama-3.3-70b-versatile", "OpenRouter", "claude-4-haiku", 80m),
        new(AiTaskIds.GenerateExercise, "Groq", "llama-3.3-70b-versatile", "OpenRouter", "gpt-4o-mini", 30m),
        new(AiTaskIds.DefineKeyword, "Groq", "llama-3.1-8b-instant", "OpenRouter", "gpt-4o-mini", 20m),
        new(AiTaskIds.DescribeNotation, "Groq", "llama-3.3-70b-versatile", "OpenRouter", "gpt-4o-mini", 25m),
        new(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m),
    ];
}
