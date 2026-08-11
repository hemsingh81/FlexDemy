using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Application.AiConfig;

public class AiConfigService(
    IAiTaskConfigRepository repository, IAiBudgetService budgetService, IUnitOfWork unitOfWork, ILogger<AiConfigService> logger)
    : IAiConfigService
{
    public async Task<IReadOnlyList<AiTaskConfigDto>> GetAllTaskConfigsAsync(CancellationToken cancellationToken = default)
    {
        var configs = await repository.GetAllAsync(cancellationToken);
        // Order to match AiTaskIds.All / the frontend's row order, not arbitrary DB order.
        var byTaskId = configs.ToDictionary(c => c.TaskId);

        // A known AiTaskIds entry with no DB row indicates a seeding gap (partial seed, or a
        // newly-added task not yet backfilled) -- log it rather than silently returning fewer
        // than 7 rows with no trace of why (review finding, 2026-08-11 review).
        var missing = AiTaskIds.All.Where(taskId => !byTaskId.ContainsKey(taskId)).ToList();
        if (missing.Count > 0)
        {
            logger.LogWarning("No AiTaskConfig row found for AI Task id(s): {MissingTaskIds}", string.Join(", ", missing));
        }

        // A task with no budget row (a separate seeding gap from the one above) defaults to 0m
        // rather than failing the whole list -- Story 1.8, GetAllSpentAsync's own documented shape.
        var spentByTask = await budgetService.GetAllSpentAsync(cancellationToken);

        return AiTaskIds.All
            .Where(byTaskId.ContainsKey)
            .Select(taskId => byTaskId[taskId].ToDto(spentByTask.GetValueOrDefault(taskId, 0m)))
            .ToList();
    }

    public async Task<AiTaskConfigDto> GetTaskConfigAsync(string taskId, CancellationToken cancellationToken = default)
    {
        ValidateTaskId(taskId);

        var config = await repository.GetByTaskIdAsync(taskId, cancellationToken)
            ?? throw new NotFoundException(nameof(AiTaskConfig), taskId);

        return config.ToDto(await GetSpentOrZeroAsync(taskId, cancellationToken));
    }

    public async Task<AiTaskConfigDto> UpdateTaskConfigAsync(string taskId, UpdateAiTaskConfigRequest request, CancellationToken cancellationToken = default)
    {
        ValidateTaskId(taskId);

        // Backend re-validates independently of the frontend's own isThresholdValid check -- a
        // raw API call or a future non-web client could bypass client-side validation entirely.
        if (request.BudgetThreshold < 0)
        {
            throw new ValidationException("BudgetThreshold must be zero or greater.");
        }

        // Non-empty validation only -- deliberately NOT a closed-enum check against the
        // frontend's AI_PROVIDERS/AI_MODELS lists (FR-2: a provider/model swap must never
        // require a backend code change). Was previously documented in Dev Notes but not
        // actually implemented (review finding, 2026-08-11 review).
        RequireNonEmpty(request.Provider, nameof(request.Provider));
        RequireNonEmpty(request.Model, nameof(request.Model));
        RequireNonEmpty(request.FallbackProvider, nameof(request.FallbackProvider));
        RequireNonEmpty(request.FallbackModel, nameof(request.FallbackModel));

        var config = await repository.GetByTaskIdAsync(taskId, cancellationToken)
            ?? throw new NotFoundException(nameof(AiTaskConfig), taskId);

        config.Provider = request.Provider;
        config.Model = request.Model;
        config.FallbackProvider = request.FallbackProvider;
        config.FallbackModel = request.FallbackModel;
        config.BudgetThreshold = request.BudgetThreshold;

        repository.Update(config);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return config.ToDto(await GetSpentOrZeroAsync(taskId, cancellationToken));
    }

    // A config row existing with no matching budget row is a seeding-order edge case, not a
    // reason to fail a config read -- default to 0m rather than let NotFoundException propagate.
    private async Task<decimal> GetSpentOrZeroAsync(string taskId, CancellationToken cancellationToken)
    {
        try
        {
            return await budgetService.GetSpentAsync(taskId, cancellationToken);
        }
        catch (NotFoundException)
        {
            return 0m;
        }
    }

    private static void RequireNonEmpty(string value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ValidationException($"{fieldName} must not be empty.");
        }
    }

    private static void ValidateTaskId(string taskId)
    {
        if (!AiTaskIds.All.Contains(taskId))
        {
            throw new ValidationException($"'{taskId}' is not a known AI Task id.");
        }
    }
}
