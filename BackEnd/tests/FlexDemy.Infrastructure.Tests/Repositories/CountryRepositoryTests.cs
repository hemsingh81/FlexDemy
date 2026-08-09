using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Exercises MasterDataRepository<TEntity>'s generic Add/Update/GetAll/GetById plumbing via its
// thinnest concrete subclass (CountryRepository has no per-entity overrides).
public class CountryRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Country MakeCountry(string id, bool isActive = true) => new()
    {
        Id = id,
        Name = $"Country {id}",
        IsoCode = id,
        IsActive = isActive,
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_country()
    {
        await using var db = NewContext();
        var repository = new CountryRepository(db);

        repository.Add(MakeCountry("IN"));
        await db.SaveChangesAsync();

        var found = await repository.GetByIdAsync("IN");
        Assert.NotNull(found);
        Assert.Equal("Country IN", found!.Name);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new CountryRepository(db);

        Assert.Null(await repository.GetByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task GetAllAsync_excludes_inactive_rows_unless_includeInactive_is_true()
    {
        await using var db = NewContext();
        db.Countries.AddRange(MakeCountry("IN"), MakeCountry("US", isActive: false));
        await db.SaveChangesAsync();
        var repository = new CountryRepository(db);

        var activeOnly = await repository.GetAllAsync(includeInactive: false);
        Assert.Equal(["IN"], activeOnly.Select(c => c.Id));

        var all = await repository.GetAllAsync(includeInactive: true);
        Assert.Equal(["IN", "US"], all.Select(c => c.Id).Order());
    }

    [Fact]
    public async Task Update_persists_changes_made_to_a_tracked_entity()
    {
        await using var db = NewContext();
        var repository = new CountryRepository(db);
        var country = MakeCountry("IN");
        repository.Add(country);
        await db.SaveChangesAsync();

        country.IsActive = false;
        repository.Update(country);
        await db.SaveChangesAsync();

        var found = await repository.GetByIdAsync("IN");
        Assert.False(found!.IsActive);
    }
}
