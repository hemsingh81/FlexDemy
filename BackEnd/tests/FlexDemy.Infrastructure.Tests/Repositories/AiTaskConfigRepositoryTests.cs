using FlexDemy.Domain.AiConfig;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class AiTaskConfigRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static AiTaskConfig MakeConfig(string taskId) => new()
    {
        Id = $"cfg_{taskId}",
        TaskId = taskId,
        Provider = "Groq",
        Model = "llama-4-scout",
        FallbackProvider = "OpenRouter",
        FallbackModel = "gpt-4o-mini",
        BudgetThreshold = 50m,
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.AiTaskConfigs.AddRange(MakeConfig(AiTaskIds.ExplainTopic), MakeConfig(AiTaskIds.DefineKeyword));
        await db.SaveChangesAsync();
        var repository = new AiTaskConfigRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetByTaskIdAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.AiTaskConfigs.Add(MakeConfig(AiTaskIds.ExplainTopic));
        await db.SaveChangesAsync();
        var repository = new AiTaskConfigRepository(db);

        var found = await repository.GetByTaskIdAsync(AiTaskIds.ExplainTopic);

        Assert.NotNull(found);
        Assert.Equal(AiTaskIds.ExplainTopic, found!.TaskId);
    }

    [Fact]
    public async Task GetByTaskIdAsync_returns_null_for_an_unknown_taskId()
    {
        await using var db = NewContext();
        var repository = new AiTaskConfigRepository(db);

        Assert.Null(await repository.GetByTaskIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task Update_persists_changes_made_to_a_tracked_entity()
    {
        await using var db = NewContext();
        var repository = new AiTaskConfigRepository(db);
        var config = MakeConfig(AiTaskIds.ExplainTopic);
        db.AiTaskConfigs.Add(config);
        await db.SaveChangesAsync();

        config.BudgetThreshold = 999m;
        repository.Update(config);
        await db.SaveChangesAsync();

        var found = await repository.GetByTaskIdAsync(AiTaskIds.ExplainTopic);
        Assert.Equal(999m, found!.BudgetThreshold);
    }
}
