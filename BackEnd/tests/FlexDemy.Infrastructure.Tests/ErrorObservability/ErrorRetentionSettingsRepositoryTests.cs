using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Infrastructure.ErrorObservability;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.ErrorObservability;

public class ErrorRetentionSettingsRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task GetAsync_returns_the_existing_row()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 90 });
        await db.SaveChangesAsync();
        var repository = new ErrorRetentionSettingsRepository(db);

        var settings = await repository.GetAsync(CancellationToken.None);

        Assert.NotNull(settings);
        Assert.Equal(90, settings!.RetentionDays);
    }

    [Fact]
    public async Task GetAsync_returns_null_when_no_row_exists()
    {
        await using var db = NewContext();
        var repository = new ErrorRetentionSettingsRepository(db);

        Assert.Null(await repository.GetAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Add_stages_a_new_row_that_persists_on_SaveChanges()
    {
        await using var db = NewContext();
        var repository = new ErrorRetentionSettingsRepository(db);

        repository.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 180 });
        await db.SaveChangesAsync();

        var found = await repository.GetAsync(CancellationToken.None);
        Assert.NotNull(found);
        Assert.Equal(180, found!.RetentionDays);
    }

    [Fact]
    public async Task Update_persists_changes_made_to_a_tracked_entity()
    {
        await using var db = NewContext();
        var settings = new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 180 };
        db.ErrorRetentionSettings.Add(settings);
        await db.SaveChangesAsync();
        var repository = new ErrorRetentionSettingsRepository(db);

        settings.RetentionDays = 365;
        repository.Update(settings);
        await db.SaveChangesAsync();

        var found = await repository.GetAsync(CancellationToken.None);
        Assert.Equal(365, found!.RetentionDays);
    }
}
