using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Every IEntityTypeConfiguration<T> registers builder.HasQueryFilter(e => !e.IsDeleted) --
// exercised once here via Country (CountryConfiguration/MasterDataRepository<T>'s thinnest
// concrete subclass); the same HasQueryFilter call is repeated identically for the other 9
// entity configurations, so this isn't re-verified per entity.
public class CountrySoftDeleteTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task GetAllAsync_and_GetByIdAsync_exclude_soft_deleted_rows_even_when_includeInactive_is_true()
    {
        await using var db = NewContext();
        db.Countries.AddRange(
            new Country { Id = "IN", Name = "India", IsoCode = "IN" },
            new Country { Id = "US", Name = "United States", IsoCode = "US", IsDeleted = true });
        await db.SaveChangesAsync();
        var repository = new CountryRepository(db);

        var all = await repository.GetAllAsync(includeInactive: true);
        Assert.Equal(["IN"], all.Select(c => c.Id));

        Assert.Null(await repository.GetByIdAsync("US"));
    }

    // End-to-end proof of the new soft-delete path (CountryService.DeleteAsync's exact sequence:
    // GetByIdAsync -> set IsDeleted -> Update -> SaveChanges): a row visible before the delete
    // is gone from GetAllAsync afterward, purely from the existing HasQueryFilter -- no bespoke
    // exclusion logic needed anywhere in the delete path itself.
    [Fact]
    public async Task A_row_deleted_via_the_GetByIdAsync_then_Update_soft_delete_sequence_is_excluded_afterward()
    {
        await using var db = NewContext();
        var repository = new CountryRepository(db);
        repository.Add(new Country { Id = "IN", Name = "India", IsoCode = "IN" });
        await db.SaveChangesAsync();

        Assert.Equal(["IN"], (await repository.GetAllAsync(includeInactive: true)).Select(c => c.Id));

        var toDelete = await repository.GetByIdAsync("IN");
        Assert.NotNull(toDelete);
        toDelete!.IsDeleted = true;
        repository.Update(toDelete);
        await db.SaveChangesAsync();

        Assert.Empty(await repository.GetAllAsync(includeInactive: true));
        Assert.Null(await repository.GetByIdAsync("IN"));
    }
}
