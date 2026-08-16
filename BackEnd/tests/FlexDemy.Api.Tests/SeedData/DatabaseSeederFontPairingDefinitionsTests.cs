using FlexDemy.Api.SeedData;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.SeedData;

// Proves EnsureFontPairingDefinitionsAsync's per-slug idempotency (Story 6.2's Task 5), and the
// cross-seeder consistency this story depends on: EnsureSettingsAsync's seeded Setting.Value
// ("default") must resolve against a real FontPairingDefinition.Slug once both seeders have run.
public class DatabaseSeederFontPairingDefinitionsTests
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
    public async Task SeedAsync_seeds_the_default_FontPairingDefinition_row_on_a_fresh_database()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var pairing = await db.FontPairingDefinitions.SingleOrDefaultAsync(f => f.Slug == "default");
        Assert.NotNull(pairing);
        Assert.True(pairing!.IsActive);
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_the_default_FontPairingDefinition_row_when_it_already_exists()
    {
        await using var db = NewContext();
        db.FontPairingDefinitions.Add(new FontPairingDefinition
        {
            Id = "existing",
            Slug = "default",
            DisplayFont = "custom",
            BodyFont = "custom",
            MonoFont = "custom",
            IsActive = true,
        });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var pairings = await db.FontPairingDefinitions.Where(f => f.Slug == "default").ToListAsync();
        Assert.Single(pairings);
        Assert.Equal("custom", pairings[0].DisplayFont);
    }

    [Fact]
    public async Task SeedAsync_leaves_the_seeded_Font_Setting_resolvable_against_a_real_FontPairingDefinition()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var fontSetting = await db.Settings.SingleAsync(s => s.Key == "font.pairing" && s.KeyType == "Font");
        var pairing = await db.FontPairingDefinitions.SingleOrDefaultAsync(f => f.Slug == fontSetting.Value);
        Assert.NotNull(pairing);
        Assert.True(pairing!.IsActive);
    }
}
