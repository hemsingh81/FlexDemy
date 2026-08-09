using FlexDemy.Application.Common;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Persistence.Interceptors;

// AuditSaveChangesInterceptor stamps CreatedAt/CreatedBy on insert and UpdatedAt/UpdatedBy on
// update for every AuditableEntity, so Application services no longer need to set those
// themselves (see the Country/State/etc. mappers -- their ToEntity methods no longer take a
// timestamp parameter).
public class AuditSaveChangesInterceptorTests
{
    private static FlexDemyDbContext NewContext(ICurrentUserService currentUserService) =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new AuditSaveChangesInterceptor(currentUserService))
            .Options);

    [Fact]
    public async Task SaveChangesAsync_stamps_CreatedAt_and_CreatedBy_on_insert()
    {
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns("usr_1");
        await using var db = NewContext(currentUserService);

        var country = new Country { Id = "IN", Name = "India", IsoCode = "IN" };
        db.Countries.Add(country);
        await db.SaveChangesAsync();

        Assert.NotEqual(default, country.CreatedAt);
        Assert.Equal("usr_1", country.CreatedBy);
        Assert.Null(country.UpdatedAt);
        Assert.Null(country.UpdatedBy);
    }

    [Fact]
    public async Task SaveChangesAsync_does_not_clobber_a_CreatedAt_or_CreatedBy_already_set_by_the_caller()
    {
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns("usr_interceptor");
        await using var db = NewContext(currentUserService);

        var explicitCreatedAt = new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var country = new Country { Id = "IN", Name = "India", IsoCode = "IN", CreatedAt = explicitCreatedAt, CreatedBy = "usr_caller" };
        db.Countries.Add(country);
        await db.SaveChangesAsync();

        Assert.Equal(explicitCreatedAt, country.CreatedAt);
        Assert.Equal("usr_caller", country.CreatedBy);
    }

    [Fact]
    public async Task SaveChangesAsync_stamps_UpdatedAt_and_UpdatedBy_on_update_and_leaves_CreatedAt_untouched()
    {
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns("usr_1");
        await using var db = NewContext(currentUserService);

        var country = new Country { Id = "IN", Name = "India", IsoCode = "IN" };
        db.Countries.Add(country);
        await db.SaveChangesAsync();
        var createdAt = country.CreatedAt;

        currentUserService.UserId.Returns("usr_2");
        country.Name = "Bharat";
        db.Countries.Update(country);
        await db.SaveChangesAsync();

        Assert.Equal(createdAt, country.CreatedAt);
        Assert.Equal("usr_1", country.CreatedBy);
        Assert.NotNull(country.UpdatedAt);
        Assert.Equal("usr_2", country.UpdatedBy);
    }
}
