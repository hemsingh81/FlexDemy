using FlexDemy.Application.Common;
using FlexDemy.Domain.AiUsage;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Application.AiUsage;

// AD-18: a thin layer over IAiTaskBudgetRepository's atomic reserve/adjust operations -- no
// IUnitOfWork dependency, since every write here is a standalone raw-SQL statement that commits
// itself (see IAiTaskBudgetRepository's own header comment).
public class AiBudgetService(IAiTaskBudgetRepository repository, ILogger<AiBudgetService> logger) : IAiBudgetService
{
    public async Task<bool> TryReserveAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default)
    {
        var reserved = await repository.TryReserveAsync(taskId, estimatedCost, cancellationToken);
        if (!reserved)
        {
            logger.LogWarning("AI Task '{TaskId}' budget reserve of {EstimatedCost} was blocked -- threshold would be exceeded (or no budget row exists).", taskId, estimatedCost);
        }
        return reserved;
    }

    public Task SettleAsync(string taskId, decimal estimatedCost, decimal actualCost, CancellationToken cancellationToken = default) =>
        AdjustSpentAndLogIfDroppedAsync(taskId, actualCost - estimatedCost, "settle", cancellationToken);

    public Task ReleaseReservationAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default) =>
        AdjustSpentAndLogIfDroppedAsync(taskId, -estimatedCost, "release", cancellationToken);

    // AdjustSpentAsync's raw UPDATE silently no-ops (0 rows affected) if the budget row is missing
    // -- unlike TryReserveAsync's "blocked" outcome, that would otherwise vanish with zero trace,
    // since it isn't an exception (review finding, 2026-08-11).
    private async Task AdjustSpentAndLogIfDroppedAsync(string taskId, decimal delta, string operation, CancellationToken cancellationToken)
    {
        var rows = await repository.AdjustSpentAsync(taskId, delta, cancellationToken);
        if (rows == 0)
        {
            logger.LogWarning("AI Task '{TaskId}' budget {Operation} of {Delta} was dropped -- no budget row exists.", taskId, operation, delta);
        }
    }

    public async Task<decimal> GetSpentAsync(string taskId, CancellationToken cancellationToken = default)
    {
        var budget = await repository.GetByTaskIdAsync(taskId, cancellationToken)
            ?? throw new NotFoundException(nameof(AiTaskBudget), taskId);
        return budget.Spent;
    }

    public async Task<IReadOnlyDictionary<string, decimal>> GetAllSpentAsync(CancellationToken cancellationToken = default)
    {
        var budgets = await repository.GetAllAsync(cancellationToken);
        return budgets.ToDictionary(b => b.TaskId, b => b.Spent);
    }
}
