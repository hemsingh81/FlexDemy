using FlexDemy.Domain.AiConfig;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// TryReserveAsync/AdjustSpentAsync issue raw SQL (ExecuteSqlInterpolatedAsync) which EF Core's
// InMemory provider cannot translate -- same category of gap BackEnd/CLAUDE.md's Testing section
// already documents for other Npgsql-specific LINQ. Only the plain-LINQ read methods are covered
// here; the raw-SQL methods are exercised against real Postgres, not by this test file.
public class AiTaskBudgetRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static AiTaskBudget MakeBudget(string taskId, decimal spent = 0m) => new()
    {
        Id = $"budget_{taskId}",
        TaskId = taskId,
        Spent = spent,
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.AiTaskBudgets.AddRange(MakeBudget(AiTaskIds.ExplainTopic), MakeBudget(AiTaskIds.DefineKeyword));
        await db.SaveChangesAsync();
        var repository = new AiTaskBudgetRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetByTaskIdAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.AiTaskBudgets.Add(MakeBudget(AiTaskIds.ExplainTopic, spent: 12.5m));
        await db.SaveChangesAsync();
        var repository = new AiTaskBudgetRepository(db);

        var found = await repository.GetByTaskIdAsync(AiTaskIds.ExplainTopic);

        Assert.NotNull(found);
        Assert.Equal(12.5m, found!.Spent);
    }

    [Fact]
    public async Task GetByTaskIdAsync_returns_null_for_an_unknown_taskId()
    {
        await using var db = NewContext();
        var repository = new AiTaskBudgetRepository(db);

        Assert.Null(await repository.GetByTaskIdAsync("does_not_exist"));
    }
}
