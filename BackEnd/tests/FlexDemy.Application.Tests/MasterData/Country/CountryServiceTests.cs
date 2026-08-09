using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Country;
using NSubstitute;
using Xunit;
using DomainCountry = FlexDemy.Domain.MasterData.Country;

namespace FlexDemy.Application.Tests.MasterData.Country;

public class CountryServiceTests
{
    private static DomainCountry MakeCountry(string id = "country_1", bool isActive = true) => new()
    {
        Id = id,
        Name = "India",
        IsoCode = "IN",
        IsActive = isActive,
    };

    [Fact]
    public async Task GetByIdAsync_returns_the_mapped_dto_when_found()
    {
        var repository = Substitute.For<ICountryRepository>();
        repository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(MakeCountry());
        var sut = new CountryService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var result = await sut.GetByIdAsync("country_1");

        Assert.Equal("country_1", result.Id);
        Assert.Equal("India", result.Name);
        Assert.Equal("IN", result.IsoCode);
    }

    [Fact]
    public async Task GetByIdAsync_throws_NotFoundException_when_missing()
    {
        var repository = Substitute.For<ICountryRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainCountry?)null);
        var sut = new CountryService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.GetByIdAsync("missing"));
    }

    [Fact]
    public async Task CreateAsync_assigns_an_id_stages_the_entity_and_commits_once()
    {
        var repository = Substitute.For<ICountryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("country_new");
        var sut = new CountryService(repository, unitOfWork, idGenerator);

        var request = new CreateCountryRequest("India", "IN");

        var result = await sut.CreateAsync(request);

        Assert.Equal("country_new", result.Id);
        repository.Received(1).Add(Arg.Is<DomainCountry>(c => c.Id == "country_new" && c.IsoCode == "IN"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("", "IN")]
    [InlineData("   ", "IN")]
    [InlineData("India", "")]
    [InlineData("India", "   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_or_IsoCode_is_blank(string name, string isoCode)
    {
        var repository = Substitute.For<ICountryRepository>();
        var sut = new CountryService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateCountryRequest(name, isoCode);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainCountry>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Name_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<ICountryRepository>();
        var existing = MakeCountry();
        repository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new CountryService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateCountryRequest("   ", "IN", true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("country_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainCountry>());
    }

    [Fact]
    public async Task UpdateAsync_applies_the_request_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<ICountryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeCountry();
        repository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new CountryService(repository, unitOfWork, Substitute.For<IIdGenerator>());

        var request = new UpdateCountryRequest("India", "IN", IsActive: false);

        var result = await sut.UpdateAsync("country_1", request);

        Assert.False(result.IsActive);
        repository.Received(1).Update(Arg.Is<DomainCountry>(c => c.Id == "country_1" && !c.IsActive));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<ICountryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeCountry();
        repository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new CountryService(repository, unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("country_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainCountry>(c => c.Id == "country_1" && c.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_country_is_missing()
    {
        var repository = Substitute.For<ICountryRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainCountry?)null);
        var sut = new CountryService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainCountry>());
    }
}
