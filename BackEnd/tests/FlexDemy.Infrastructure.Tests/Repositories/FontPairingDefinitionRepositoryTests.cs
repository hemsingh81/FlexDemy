using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class FontPairingDefinitionRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static FontPairingDefinition MakePairing(string slug) => new()
    {
        Id = $"fpd_{slug}",
        Slug = slug,
        DisplayFont = "\"Fraunces\", Georgia, serif",
        BodyFont = "\"Outfit\", system-ui, sans-serif",
        MonoFont = "\"JetBrains Mono\", monospace",
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.FontPairingDefinitions.AddRange(MakePairing("default"), MakePairing("warm-editorial"));
        await db.SaveChangesAsync();
        var repository = new FontPairingDefinitionRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetAllAsync_returns_empty_on_a_fresh_table()
    {
        await using var db = NewContext();
        var repository = new FontPairingDefinitionRepository(db);

        Assert.Empty(await repository.GetAllAsync());
    }

    [Fact]
    public async Task GetBySlugAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.FontPairingDefinitions.Add(MakePairing("default"));
        await db.SaveChangesAsync();
        var repository = new FontPairingDefinitionRepository(db);

        var result = await repository.GetBySlugAsync("default");

        Assert.NotNull(result);
        Assert.Equal("default", result!.Slug);
    }

    [Fact]
    public async Task GetBySlugAsync_returns_null_when_no_row_matches()
    {
        await using var db = NewContext();
        var repository = new FontPairingDefinitionRepository(db);

        Assert.Null(await repository.GetBySlugAsync("missing"));
    }

    // AD-26's unique Slug index (FontPairingDefinitionConfiguration.cs's HasIndex(f =>
    // f.Slug).IsUnique()) is a real Postgres-level guarantee, verified present in the generated
    // migration. Not testable here -- same documented EF Core InMemory limitation
    // SettingRepositoryTests.cs already covers for AD-25's composite index (Story 6.1): InMemory
    // does not enforce HasIndex(...).IsUnique() at all.
}
