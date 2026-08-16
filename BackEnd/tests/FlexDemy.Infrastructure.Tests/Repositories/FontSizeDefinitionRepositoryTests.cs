using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class FontSizeDefinitionRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static FontSizeDefinition MakeSize(string slug) => new()
    {
        Id = $"fsd_{slug}",
        Slug = slug,
        RootFontScale = "100%",
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.FontSizeDefinitions.AddRange(MakeSize("default"), MakeSize("comfortable"));
        await db.SaveChangesAsync();
        var repository = new FontSizeDefinitionRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetAllAsync_returns_empty_on_a_fresh_table()
    {
        await using var db = NewContext();
        var repository = new FontSizeDefinitionRepository(db);

        Assert.Empty(await repository.GetAllAsync());
    }

    [Fact]
    public async Task GetBySlugAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.FontSizeDefinitions.Add(MakeSize("default"));
        await db.SaveChangesAsync();
        var repository = new FontSizeDefinitionRepository(db);

        var result = await repository.GetBySlugAsync("default");

        Assert.NotNull(result);
        Assert.Equal("default", result!.Slug);
    }

    [Fact]
    public async Task GetBySlugAsync_returns_null_when_no_row_matches()
    {
        await using var db = NewContext();
        var repository = new FontSizeDefinitionRepository(db);

        Assert.Null(await repository.GetBySlugAsync("missing"));
    }

    // Unique Slug index (FontSizeDefinitionConfiguration.cs's HasIndex(f =>
    // f.Slug).IsUnique()) is a real Postgres-level guarantee, verified present in the generated
    // migration. Not testable here -- same documented EF Core InMemory limitation
    // FontPairingDefinitionRepositoryTests.cs already covers.
}
