using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Exercises StateRepository's own GetAllAsync overload (parent-id filtering), which is the
// per-entity variance layered on top of MasterDataRepository<TEntity>'s shared plumbing.
public class StateRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static State MakeState(string id, string countryId, bool isActive = true) => new()
    {
        Id = id,
        CountryId = countryId,
        Name = $"State {id}",
        Code = id,
        IsActive = isActive,
    };

    [Fact]
    public async Task GetAllAsync_filters_by_countryId_when_provided()
    {
        await using var db = NewContext();
        db.States.AddRange(
            MakeState("MH", "country_in"),
            MakeState("KA", "country_in"),
            MakeState("CA", "country_us"));
        await db.SaveChangesAsync();
        var repository = new StateRepository(db);

        var inStates = await repository.GetAllAsync(includeInactive: false, countryId: "country_in");
        Assert.Equal(["KA", "MH"], inStates.Select(s => s.Id).Order());

        var all = await repository.GetAllAsync(includeInactive: false, countryId: null);
        Assert.Equal(["CA", "KA", "MH"], all.Select(s => s.Id).Order());
    }

    [Fact]
    public async Task GetAllAsync_excludes_inactive_rows_unless_includeInactive_is_true()
    {
        await using var db = NewContext();
        db.States.AddRange(
            MakeState("MH", "country_in"),
            MakeState("KA", "country_in", isActive: false));
        await db.SaveChangesAsync();
        var repository = new StateRepository(db);

        var activeOnly = await repository.GetAllAsync(includeInactive: false, countryId: null);
        Assert.Equal(["MH"], activeOnly.Select(s => s.Id));

        var all = await repository.GetAllAsync(includeInactive: true, countryId: null);
        Assert.Equal(["KA", "MH"], all.Select(s => s.Id).Order());
    }
}
