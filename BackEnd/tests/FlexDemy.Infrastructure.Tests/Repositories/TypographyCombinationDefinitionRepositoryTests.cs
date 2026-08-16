using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class TypographyCombinationDefinitionRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static TypographyCombinationDefinition MakeCombo(string slug) => new()
    {
        Id = $"tcd_{slug}",
        Slug = slug,
        Label = slug,
        FontPairingSlug = "default",
        FontSizeSlug = "default",
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.TypographyCombinationDefinitions.AddRange(MakeCombo("default"), MakeCombo("comfortable"));
        await db.SaveChangesAsync();
        var repository = new TypographyCombinationDefinitionRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetAllAsync_returns_empty_on_a_fresh_table()
    {
        await using var db = NewContext();
        var repository = new TypographyCombinationDefinitionRepository(db);

        Assert.Empty(await repository.GetAllAsync());
    }

    [Fact]
    public async Task GetBySlugAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.TypographyCombinationDefinitions.Add(MakeCombo("default"));
        await db.SaveChangesAsync();
        var repository = new TypographyCombinationDefinitionRepository(db);

        var result = await repository.GetBySlugAsync("default");

        Assert.NotNull(result);
        Assert.Equal("default", result!.Slug);
    }

    [Fact]
    public async Task GetBySlugAsync_returns_null_when_no_row_matches()
    {
        await using var db = NewContext();
        var repository = new TypographyCombinationDefinitionRepository(db);

        Assert.Null(await repository.GetBySlugAsync("missing"));
    }

    // Same documented EF Core InMemory limitation FontPairingDefinitionRepositoryTests.cs/
    // SettingRepositoryTests.cs already cover: InMemory does not enforce
    // HasIndex(...).IsUnique() at all, so the Slug unique index isn't testable here.
}
