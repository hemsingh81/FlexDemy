using FlexDemy.Api.SeedData;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.SeedData;

// Regression test for a review finding (2026-08-11): EnsureAiConfigAsync used to skip seeding
// entirely once ANY AiTaskConfig row existed, so a partial prior seed (or a future AiTaskIds
// entry) never got backfilled. It must now seed per-task.
public class DatabaseSeederAiConfigTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static IIdGenerator FakeIdGenerator()
    {
        var counter = 0;
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns(_ => $"id_{counter++}");
        return idGenerator;
    }

    [Fact]
    public async Task SeedAsync_seeds_all_AiTaskConfig_rows_on_a_fresh_database()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var seededTaskIds = await db.AiTaskConfigs.Select(c => c.TaskId).ToListAsync();
        Assert.Equal(AiTaskIds.All.OrderBy(x => x), seededTaskIds.OrderBy(x => x));
    }

    [Fact]
    public async Task SeedAsync_backfills_missing_tasks_instead_of_skipping_entirely_when_one_row_already_exists()
    {
        await using var db = NewContext();
        // Simulate a partial prior seed: only one task's row exists.
        db.AiTaskConfigs.Add(new AiTaskConfig
        {
            Id = "existing",
            TaskId = AiTaskIds.DefineKeyword,
            Provider = "Groq",
            Model = "llama-4-maverick",
            FallbackProvider = "OpenRouter",
            FallbackModel = "claude-4-haiku",
            BudgetThreshold = 80m,
        });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var seededTaskIds = await db.AiTaskConfigs.Select(c => c.TaskId).ToListAsync();
        Assert.Equal(AiTaskIds.All.OrderBy(x => x), seededTaskIds.OrderBy(x => x));
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_a_task_that_already_has_a_row()
    {
        await using var db = NewContext();
        db.AiTaskConfigs.Add(new AiTaskConfig
        {
            Id = "existing",
            TaskId = AiTaskIds.DefineKeyword,
            Provider = "CustomProvider",
            Model = "custom-model",
            FallbackProvider = "OpenRouter",
            FallbackModel = "claude-4-haiku",
            BudgetThreshold = 999m,
        });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var defineKeywordRows = await db.AiTaskConfigs.Where(c => c.TaskId == AiTaskIds.DefineKeyword).ToListAsync();
        Assert.Single(defineKeywordRows);
        // The pre-existing (admin-edited-looking) row is left untouched, not overwritten by the seed default.
        Assert.Equal("CustomProvider", defineKeywordRows[0].Provider);
    }

    [Fact]
    public async Task SeedAsync_seeds_one_AiPromptVersion_per_backfilled_task()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var seededTaskIds = await db.AiPromptVersions.Select(v => v.TaskId).ToListAsync();
        Assert.Equal(AiTaskIds.All.OrderBy(x => x), seededTaskIds.OrderBy(x => x));
    }
}
