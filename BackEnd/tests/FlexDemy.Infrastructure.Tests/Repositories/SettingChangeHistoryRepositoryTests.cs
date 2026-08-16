using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class SettingChangeHistoryRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static SettingChangeHistory MakeEntry(string id, string settingId, DateTimeOffset createdAt) => new()
    {
        Id = id,
        SettingId = settingId,
        Key = "font.pairing",
        KeyType = "Font",
        OldValue = "default",
        NewValue = "editorial",
        CreatedAt = createdAt,
    };

    [Fact]
    public async Task GetBySettingIdAsync_returns_entries_ordered_newest_first()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        db.SettingChangeHistories.AddRange(
            MakeEntry("h1", "setting_1", now.AddMinutes(-10)),
            MakeEntry("h2", "setting_1", now),
            MakeEntry("h3", "setting_1", now.AddMinutes(-5)));
        await db.SaveChangesAsync();
        var repository = new SettingChangeHistoryRepository(db);

        var result = await repository.GetBySettingIdAsync("setting_1");

        Assert.Equal(["h2", "h3", "h1"], result.Select(h => h.Id));
    }

    [Fact]
    public async Task GetBySettingIdAsync_returns_only_entries_for_the_requested_SettingId()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        db.SettingChangeHistories.AddRange(
            MakeEntry("h1", "setting_1", now),
            MakeEntry("h2", "setting_2", now));
        await db.SaveChangesAsync();
        var repository = new SettingChangeHistoryRepository(db);

        var result = await repository.GetBySettingIdAsync("setting_1");

        var entry = Assert.Single(result);
        Assert.Equal("h1", entry.Id);
    }

    [Fact]
    public async Task GetBySettingIdAsync_returns_empty_when_no_entries_exist_for_the_setting()
    {
        await using var db = NewContext();
        var repository = new SettingChangeHistoryRepository(db);

        Assert.Empty(await repository.GetBySettingIdAsync("missing"));
    }

    [Fact]
    public void Add_stages_the_entity_without_saving()
    {
        using var db = NewContext();
        var repository = new SettingChangeHistoryRepository(db);

        repository.Add(MakeEntry("h1", "setting_1", DateTimeOffset.UtcNow));

        Assert.Equal(Microsoft.EntityFrameworkCore.EntityState.Added, db.Entry(db.SettingChangeHistories.Local.Single()).State);
    }
}
