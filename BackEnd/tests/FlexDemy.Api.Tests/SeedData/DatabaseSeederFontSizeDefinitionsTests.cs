using FlexDemy.Api.SeedData;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.SeedData;

// Proves EnsureFontSizeDefinitionsAsync's per-slug idempotency (Story 6.4), and the
// cross-seeder consistency this story depends on: EnsureSettingsAsync's seeded FontSize
// Setting.Value ("default") must resolve against a real FontSizeDefinition.Slug once both
// seeders have run. Mirrors DatabaseSeederFontPairingDefinitionsTests.cs exactly.
public class DatabaseSeederFontSizeDefinitionsTests
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
    public async Task SeedAsync_seeds_the_default_FontSizeDefinition_row_on_a_fresh_database()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var size = await db.FontSizeDefinitions.SingleOrDefaultAsync(f => f.Slug == "default");
        Assert.NotNull(size);
        Assert.Equal("100%", size!.RootFontScale);
        Assert.True(size.IsActive);
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_the_default_FontSizeDefinition_row_when_it_already_exists()
    {
        await using var db = NewContext();
        db.FontSizeDefinitions.Add(new FontSizeDefinition
        {
            Id = "existing",
            Slug = "default",
            RootFontScale = "90%",
            IsActive = true,
        });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var sizes = await db.FontSizeDefinitions.Where(f => f.Slug == "default").ToListAsync();
        Assert.Single(sizes);
        Assert.Equal("90%", sizes[0].RootFontScale);
    }

    [Fact]
    public async Task SeedAsync_leaves_the_seeded_FontSize_Setting_resolvable_against_a_real_FontSizeDefinition()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var fontSizeSetting = await db.Settings.SingleAsync(s => s.Key == "font.size" && s.KeyType == "FontSize");
        var size = await db.FontSizeDefinitions.SingleOrDefaultAsync(f => f.Slug == fontSizeSetting.Value);
        Assert.NotNull(size);
        Assert.True(size!.IsActive);
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_the_FontSize_Setting_row_when_it_already_exists()
    {
        // Code-review patch (2026-08-16): Task 1 asked for idempotency coverage of BOTH the
        // FontSizeDefinition row (covered above) and the ("font.size","FontSize") Setting row
        // itself -- only the former had a dedicated test. This relies on EnsureSettingsAsync's
        // existing, untouched-by-this-story dedup logic, but the story's own seed entry deserves
        // its own regression test rather than riding entirely on Story 6.1's generic coverage.
        await using var db = NewContext();
        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var settings = await db.Settings.Where(s => s.Key == "font.size" && s.KeyType == "FontSize").ToListAsync();
        Assert.Single(settings);
    }
}
