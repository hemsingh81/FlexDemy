using FlexDemy.Api.SeedData;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.SeedData;

// Story 6.5: proves EnsureFontSizeDefinitionsAsync's 4 new scales and EnsureTypographyCombinationsAsync's
// 5 curated presets seed correctly, don't duplicate on rerun, and -- the cross-seeder consistency
// check that actually matters here -- every seeded combo's FontPairingSlug/FontSizeSlug resolves
// against a real, active definition once all seeders have run. If this ever breaks, the seeded
// combos themselves would fail ApplyTypographyCombinationAsync's own curation validation.
public class DatabaseSeederTypographyCombinationsTests
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
    public async Task SeedAsync_seeds_all_4_new_FontSizeDefinition_scales_on_a_fresh_database()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var slugs = await db.FontSizeDefinitions.Select(f => f.Slug).ToListAsync();
        Assert.Contains("compact", slugs);
        Assert.Contains("comfortable", slugs);
        Assert.Contains("large", slugs);
        Assert.Contains("presentation", slugs);
    }

    [Fact]
    public async Task SeedAsync_seeds_the_curated_themes_active_and_the_superseded_ones_retired()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var combos = await db.TypographyCombinationDefinitions.ToListAsync();
        // Every theme the Admin -> Settings picker offers. Asserted by slug, not just by count, so
        // a rename/drop is a failure rather than something a matching total silently hides.
        Assert.Equal(
            new[]
            {
                "academic", "accessible", "classic", "compact", "default", "editorial",
                "elegant", "friendly", "modern", "presentation", "technical",
            },
            combos.Where(c => c.IsActive).Select(c => c.Slug).OrderBy(s => s).ToArray());
        // Retired rather than deleted: superseded by a real theme carrying the same scale, but kept
        // so existing SettingChangeHistory entries pointing at them stay resolvable.
        Assert.Equal(
            new[] { "comfortable", "large" },
            combos.Where(c => !c.IsActive).Select(c => c.Slug).OrderBy(s => s).ToArray());
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_TypographyCombinationDefinition_rows_when_they_already_exist()
    {
        await using var db = NewContext();
        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());
        var firstRunCount = await db.TypographyCombinationDefinitions.CountAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        Assert.Equal(firstRunCount, await db.TypographyCombinationDefinitions.CountAsync());
    }

    // EnsureTypographyCombinationsAsync reconciles rather than inserting-missing-only (unlike its
    // sibling seeders) -- specifically so already-persisted rows from the era when only one font
    // pairing existed get corrected instead of being stranded forever on a database that has
    // already been seeded once. That's the behaviour worth pinning: insert-missing-only would leave
    // the stale row exactly as-is and this test would fail.
    [Fact]
    public async Task SeedAsync_corrects_an_existing_row_that_no_longer_matches_the_curated_definition()
    {
        await using var db = NewContext();
        db.TypographyCombinationDefinitions.Add(new TypographyCombinationDefinition
        {
            Id = "stale_row",
            Slug = "academic",
            Label = "Stale Label",
            FontPairingSlug = "default",
            FontSizeSlug = "compact",
            IsActive = false,
        });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var academic = await db.TypographyCombinationDefinitions.SingleAsync(c => c.Slug == "academic");
        Assert.Equal("Academic", academic.Label);
        Assert.Equal("academic", academic.FontPairingSlug);
        Assert.Equal("comfortable", academic.FontSizeSlug);
        Assert.True(academic.IsActive);
        // Corrected in place -- not deleted and re-inserted, which would orphan any FK/history
        // reference to the original row.
        Assert.Equal("stale_row", academic.Id);
    }

    [Fact]
    public async Task Every_seeded_combo_resolves_against_a_real_active_FontPairingDefinition_and_FontSizeDefinition()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var combos = await db.TypographyCombinationDefinitions.ToListAsync();
        var pairingSlugs = await db.FontPairingDefinitions.Where(p => p.IsActive).Select(p => p.Slug).ToListAsync();
        var sizeSlugs = await db.FontSizeDefinitions.Where(s => s.IsActive).Select(s => s.Slug).ToListAsync();

        Assert.NotEmpty(combos);
        Assert.All(combos, combo =>
        {
            Assert.Contains(combo.FontPairingSlug, pairingSlugs);
            Assert.Contains(combo.FontSizeSlug, sizeSlugs);
        });
    }
}
