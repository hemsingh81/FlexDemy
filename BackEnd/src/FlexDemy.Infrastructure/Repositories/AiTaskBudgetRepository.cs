using FlexDemy.Application.AiUsage;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class AiTaskBudgetRepository(FlexDemyDbContext db) : IAiTaskBudgetRepository
{
    // Snake_case identifiers are load-bearing here -- .UseSnakeCaseNamingConvention() only
    // affects EF's own LINQ-to-SQL translation; raw SQL must spell out the real DB column names.
    public async Task<bool> TryReserveAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default)
    {
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
             UPDATE ai_task_budgets
             SET spent = spent + {estimatedCost}
             WHERE task_id = {taskId}
               AND spent + {estimatedCost} <= (SELECT budget_threshold FROM ai_task_configs WHERE task_id = ai_task_budgets.task_id)
             """,
            cancellationToken);

        return rows == 1;
    }

    public Task<int> AdjustSpentAsync(string taskId, decimal delta, CancellationToken cancellationToken = default) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE ai_task_budgets SET spent = spent + {delta} WHERE task_id = {taskId}",
            cancellationToken);

    public Task<AiTaskBudget?> GetByTaskIdAsync(string taskId, CancellationToken cancellationToken = default) =>
        db.AiTaskBudgets.FirstOrDefaultAsync(b => b.TaskId == taskId, cancellationToken);

    public Task<List<AiTaskBudget>> GetAllAsync(CancellationToken cancellationToken = default) =>
        db.AiTaskBudgets.ToListAsync(cancellationToken);
}
