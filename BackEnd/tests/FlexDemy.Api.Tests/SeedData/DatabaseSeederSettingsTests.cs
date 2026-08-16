using FlexDemy.Api.SeedData;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.SeedData;

// Proves EnsureSettingsAsync's per-item idempotency (mirroring EnsureAiConfigAsync, not
// EnsureErrorRetentionSettingsAsync's blanket skip) -- Story 6.1's Task 5.
public class DatabaseSeederSettingsTests
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
    public async Task SeedAsync_seeds_the_initial_Font_Setting_row_on_a_fresh_database()
    {
        await using var db = NewContext();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var fontSetting = await db.Settings.SingleOrDefaultAsync(s => s.Key == "font.pairing" && s.KeyType == "Font");
        Assert.NotNull(fontSetting);
        Assert.True(fontSetting!.IsActive);
    }

    [Fact]
    public async Task SeedAsync_does_not_duplicate_the_Font_Setting_row_when_it_already_exists()
    {
        await using var db = NewContext();
        db.Settings.Add(new Setting { Id = "existing", Key = "font.pairing", KeyType = "Font", Value = "admin-chosen", IsActive = true });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        var fontSettings = await db.Settings.Where(s => s.Key == "font.pairing" && s.KeyType == "Font").ToListAsync();
        Assert.Single(fontSettings);
        // The pre-existing (admin-edited-looking) row is left untouched, not overwritten by the seed default.
        Assert.Equal("admin-chosen", fontSettings[0].Value);
    }

    [Fact]
    public async Task SeedAsync_backfills_the_Font_Setting_row_when_a_different_KeyType_pair_already_exists()
    {
        await using var db = NewContext();
        // Simulate a partial prior seed: some other setting exists, but not the Font one yet.
        db.Settings.Add(new Setting { Id = "existing", Key = "logo.url", KeyType = "Branding", Value = "/logo.svg" });
        await db.SaveChangesAsync();

        await DatabaseSeeder.SeedAsync(db, FakeIdGenerator(), Substitute.For<IPasswordHasher>());

        Assert.NotNull(await db.Settings.SingleOrDefaultAsync(s => s.Key == "font.pairing" && s.KeyType == "Font"));
    }
}
