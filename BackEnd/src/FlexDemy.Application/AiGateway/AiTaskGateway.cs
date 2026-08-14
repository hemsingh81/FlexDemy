using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Fallback;

namespace FlexDemy.Application.AiGateway;

// AD-14 (Story 1.6): resolves each AI Task's primary provider/model from AiTaskConfig (via
// IAiConfigService) and calls IAiGateway with it. On AiGatewayException, retries once against
// the task's configured fallback provider/model (Polly 8.7.0 fallback policy). If the fallback
// also fails, throws AiTaskUnavailableException -- a distinct, terminal state, never a raw
// AiGatewayException or a silent hang. Does not touch IAiGateway/PortkeyAiGateway (Story 1.4) --
// this is purely the orchestration layer Story 1.4's own Dev Notes named as "layered above it."
// Story 1.7: records usage/cost (via IAiUsageService) after every successful call, regardless of
// whether the primary or the fallback served it -- a failed call (both fail) never reaches the
// recording call, since there is no AiGatewayUsage to record.
// Story 1.8 (AD-18): before any provider call, atomically reserves an *estimated* cost against
// the task's budget threshold (IAiBudgetService.TryReserveAsync) -- blocks with
// AiTaskBudgetExceededException if it would be exceeded. The reserve is NOT wrapped in a
// try/catch-swallow (fails closed: an infra failure here must block the call, not silently let
// spend through unguarded) -- unlike usage recording and budget settle/release, which fail open
// (by the time those run, the AI call already succeeded and a real response already exists).
// Once the real cost is known, the reservation is trued up (SettleAsync); if the call fails
// entirely, the full estimate is released (ReleaseReservationAsync) since nothing was spent.
public sealed class AiTaskGateway(
    IAiGateway gateway, IAiConfigService configService, IAiUsageService usageService, IAiBudgetService budgetService,
    ILogger<AiTaskGateway> logger) : IAiTaskGateway
{
    // Deliberately rough, not a tokenizer -- see Story 1.8 Dev Notes "The reservation estimate is
    // deliberately rough." The reservation window is only as long as the AI call itself; it gets
    // trued up to the exact real cost the moment the call finishes.
    private const int DefaultEstimatedCompletionTokens = 2000;

    public Task<AiTaskResult> DefineKeywordAsync(AiTaskRequest request, CancellationToken cancellationToken = default) =>
        DispatchAsync(AiTaskIds.DefineKeyword, request, gateway.DefineKeywordAsync, cancellationToken);

    // Prices BOTH the prompt (input) and completion (output) side -- omitting the prompt entirely
    // was a review-caught gap: for a prompt-heavy task (e.g. extractStructure, fed a large chunk
    // of course content), the estimate could be a small fraction of the true cost, letting
    // TryReserveAsync approve a call that SettleAsync later reveals blew well past the threshold
    // (review finding, 2026-08-11). Same 4-chars-per-token heuristic as the embeddings estimate
    // below; clamped to >= 0 so a caller-supplied negative MaxTokens can never manufacture a
    // negative reservation (which would incorrectly free up budget headroom).
    private static decimal EstimateChatReservationCost(AiTaskRequest request, AiTaskConfigDto config)
    {
        var estimatedPromptTokens = Math.Max(0, request.Messages.Sum(m => m.Content.Length) / 4);
        var estimatedCompletionTokens = Math.Max(0, request.MaxTokens ?? DefaultEstimatedCompletionTokens);
        return estimatedPromptTokens / 1_000_000m * config.PricePerMillionInputTokens +
               estimatedCompletionTokens / 1_000_000m * config.PricePerMillionOutputTokens;
    }

    private static decimal EstimateEmbeddingReservationCost(IReadOnlyList<string> input, AiTaskConfigDto config)
    {
        var estimatedInputTokens = Math.Max(0, input.Sum(s => s.Length) / 4);
        return estimatedInputTokens / 1_000_000m * config.PricePerMillionInputTokens;
    }

    private async Task<AiTaskResult> DispatchAsync(
        string taskId,
        AiTaskRequest request,
        Func<AiGatewayRequest, CancellationToken, Task<AiGatewayResponse>> primaryCall,
        CancellationToken cancellationToken)
    {
        var config = await configService.GetTaskConfigAsync(taskId, cancellationToken);

        var estimatedCost = EstimateChatReservationCost(request, config);
        if (!await budgetService.TryReserveAsync(taskId, estimatedCost, cancellationToken))
        {
            throw new AiTaskBudgetExceededException(taskId);
        }

        var usedFallback = false;

        var pipeline = new ResiliencePipelineBuilder<AiGatewayResponse>()
            .AddFallback(new FallbackStrategyOptions<AiGatewayResponse>
            {
                ShouldHandle = new PredicateBuilder<AiGatewayResponse>().Handle<AiGatewayException>(),
                FallbackAction = async args =>
                {
                    logger.LogWarning(
                        args.Outcome.Exception,
                        "AI Task '{TaskId}' primary provider '{PrimaryProvider}/{PrimaryModel}' failed; falling back to '{FallbackProvider}/{FallbackModel}'.",
                        taskId, config.Provider, config.Model, config.FallbackProvider, config.FallbackModel);

                    try
                    {
                        var fallbackRequest = new AiGatewayRequest(config.FallbackProvider, config.FallbackModel, request.Messages, request.Temperature, request.MaxTokens);
                        var fallbackResponse = await primaryCall(fallbackRequest, args.Context.CancellationToken);
                        usedFallback = true;
                        return Outcome.FromResult(fallbackResponse);
                    }
                    catch (AiGatewayException fallbackEx)
                    {
                        logger.LogError(
                            fallbackEx,
                            "AI Task '{TaskId}' fallback provider '{FallbackProvider}/{FallbackModel}' also failed.",
                            taskId, config.FallbackProvider, config.FallbackModel);
                        throw new AiTaskUnavailableException(taskId, fallbackEx);
                    }
                },
            })
            .Build();

        try
        {
            var primaryRequest = new AiGatewayRequest(config.Provider, config.Model, request.Messages, request.Temperature, request.MaxTokens);
            var response = await pipeline.ExecuteAsync(async ct => await primaryCall(primaryRequest, ct), cancellationToken);

            var actualCost = await RecordUsageSafeAsync(taskId, response.Provider, response.Model, response.Usage, usedFallback, request.CourseId, request.TutorId);
            await SettleOrReleaseBudgetSafeAsync(taskId, estimatedCost, actualCost);

            return new AiTaskResult(response.Content, response.Provider, response.Model, response.Usage, usedFallback);
        }
        catch
        {
            // Deliberately catches everything, not just AiTaskUnavailableException -- a narrower
            // catch here leaked the reservation forever for any other failure escaping the pipeline
            // (most plausibly a caller cancellation: PortkeyAiGateway lets a caller-driven
            // TaskCanceledException propagate raw, un-wrapped, which is neither AiGatewayException
            // nor AiTaskUnavailableException) (review finding, 2026-08-11). The AI call never
            // completed successfully on any path that reaches here, so releasing the full estimate
            // is always correct regardless of which exception type this is.
            await ReleaseBudgetOnFailureSafeAsync(taskId, estimatedCost);
            throw;
        }
    }

    // A usage-recording failure (e.g. a DB write error) must not turn an otherwise-successful AI
    // response into a failed call -- the caller already has a real, usable result; losing it
    // because a bookkeeping write failed would be strictly worse than serving the response with a
    // logged gap in usage tracking. Deliberately catches Exception, not a narrower type -- a
    // last-resort boundary, not a typed-exception design point.
    // Deliberately does NOT accept a CancellationToken from the caller: by this point the AI
    // provider call already succeeded and real cost was already incurred -- if the caller's own
    // token is cancelled (e.g. the HTTP request was aborted) between the successful response and
    // this write, using that token would silently drop an already-earned usage/cost record, which
    // is strictly worse than a slightly-delayed background write (review finding, 2026-08-11).
    // Returns null (instead of throwing) on a swallowed failure, so the caller (budget settle)
    // knows the real cost is unknown and must release the full estimate instead of settling to it.
    private async Task<decimal?> RecordUsageSafeAsync(
        string taskId, string provider, string model, AiGatewayUsage usage, bool usedFallback,
        string? courseId, string? tutorId)
    {
        try
        {
            return await usageService.RecordUsageAsync(taskId, provider, model, usage, usedFallback, courseId, tutorId, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to record AI Task usage for '{TaskId}'.", taskId);
            return null;
        }
    }

    // Same swallow-and-log reasoning, and the same CancellationToken.None reasoning, as
    // RecordUsageSafeAsync -- the AI call already succeeded; a budget-ledger correction failure
    // must not undo that. actualCost is null when RecordUsageSafeAsync itself failed above --
    // there is no reliable real cost to settle to, so release the full estimate instead.
    private async Task SettleOrReleaseBudgetSafeAsync(string taskId, decimal estimatedCost, decimal? actualCost)
    {
        try
        {
            if (actualCost is null)
            {
                await budgetService.ReleaseReservationAsync(taskId, estimatedCost, CancellationToken.None);
            }
            else
            {
                await budgetService.SettleAsync(taskId, estimatedCost, actualCost.Value, CancellationToken.None);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to settle/release AI Task budget reservation for '{TaskId}'.", taskId);
        }
    }

    // Called when both primary and fallback failed -- nothing was spent, release the full
    // reservation. A release failure here must not suppress the original AiTaskUnavailableException;
    // log and let the caller re-throw it.
    private async Task ReleaseBudgetOnFailureSafeAsync(string taskId, decimal estimatedCost)
    {
        try
        {
            await budgetService.ReleaseReservationAsync(taskId, estimatedCost, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to release AI Task budget reservation for '{TaskId}' after a failed call.", taskId);
        }
    }

    public async Task<AiTaskEmbeddingResult> GenerateEmbeddingAsync(
        IReadOnlyList<string> input, string? courseId = null, string? tutorId = null, CancellationToken cancellationToken = default)
    {
        var config = await configService.GetTaskConfigAsync(AiTaskIds.Embeddings, cancellationToken);

        var estimatedCost = EstimateEmbeddingReservationCost(input, config);
        if (!await budgetService.TryReserveAsync(AiTaskIds.Embeddings, estimatedCost, cancellationToken))
        {
            throw new AiTaskBudgetExceededException(AiTaskIds.Embeddings);
        }

        var usedFallback = false;

        var pipeline = new ResiliencePipelineBuilder<AiEmbeddingResponse>()
            .AddFallback(new FallbackStrategyOptions<AiEmbeddingResponse>
            {
                ShouldHandle = new PredicateBuilder<AiEmbeddingResponse>().Handle<AiGatewayException>(),
                FallbackAction = async args =>
                {
                    logger.LogWarning(
                        args.Outcome.Exception,
                        "AI Task '{TaskId}' primary provider '{PrimaryProvider}/{PrimaryModel}' failed; falling back to '{FallbackProvider}/{FallbackModel}'.",
                        AiTaskIds.Embeddings, config.Provider, config.Model, config.FallbackProvider, config.FallbackModel);

                    try
                    {
                        var fallbackRequest = new AiEmbeddingRequest(config.FallbackProvider, config.FallbackModel, input);
                        var fallbackResponse = await gateway.GenerateEmbeddingAsync(fallbackRequest, args.Context.CancellationToken);
                        usedFallback = true;
                        return Outcome.FromResult(fallbackResponse);
                    }
                    catch (AiGatewayException fallbackEx)
                    {
                        logger.LogError(
                            fallbackEx,
                            "AI Task '{TaskId}' fallback provider '{FallbackProvider}/{FallbackModel}' also failed.",
                            AiTaskIds.Embeddings, config.FallbackProvider, config.FallbackModel);
                        throw new AiTaskUnavailableException(AiTaskIds.Embeddings, fallbackEx);
                    }
                },
            })
            .Build();

        try
        {
            var primaryRequest = new AiEmbeddingRequest(config.Provider, config.Model, input);
            var response = await pipeline.ExecuteAsync(async ct => await gateway.GenerateEmbeddingAsync(primaryRequest, ct), cancellationToken);

            var actualCost = await RecordUsageSafeAsync(AiTaskIds.Embeddings, response.Provider, response.Model, response.Usage, usedFallback, courseId, tutorId);
            await SettleOrReleaseBudgetSafeAsync(AiTaskIds.Embeddings, estimatedCost, actualCost);

            return new AiTaskEmbeddingResult(response.Embeddings, response.Provider, response.Model, response.Usage, usedFallback);
        }
        catch
        {
            // See DispatchAsync's identical catch for why this deliberately isn't narrowed to
            // AiTaskUnavailableException.
            await ReleaseBudgetOnFailureSafeAsync(AiTaskIds.Embeddings, estimatedCost);
            throw;
        }
    }
}
