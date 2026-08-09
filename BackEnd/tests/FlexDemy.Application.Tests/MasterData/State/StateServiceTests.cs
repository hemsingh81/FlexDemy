using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Country;
using FlexDemy.Application.MasterData.State;
using NSubstitute;
using Xunit;
using DomainCountry = FlexDemy.Domain.MasterData.Country;
using DomainState = FlexDemy.Domain.MasterData.State;

namespace FlexDemy.Application.Tests.MasterData.State;

public class StateServiceTests
{
    private static DomainCountry MakeCountry(bool isActive = true) => new()
    {
        Id = "country_1",
        Name = "India",
        IsoCode = "IN",
        IsActive = isActive,
    };

    private static DomainState MakeState() => new()
    {
        Id = "state_1",
        CountryId = "country_1",
        Name = "Maharashtra",
        Code = "MH",
    };

    [Fact]
    public async Task CreateAsync_throws_NotFoundException_when_parent_country_is_missing()
    {
        var repository = Substitute.For<IStateRepository>();
        var countryRepository = Substitute.For<ICountryRepository>();
        countryRepository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns((DomainCountry?)null);
        var sut = new StateService(repository, countryRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateStateRequest("country_1", "Maharashtra", "MH");

        await Assert.ThrowsAsync<NotFoundException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainState>());
    }

    [Fact]
    public async Task CreateAsync_throws_ValidationException_when_parent_country_is_inactive()
    {
        var repository = Substitute.For<IStateRepository>();
        var countryRepository = Substitute.For<ICountryRepository>();
        countryRepository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(MakeCountry(isActive: false));
        var sut = new StateService(repository, countryRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateStateRequest("country_1", "Maharashtra", "MH");

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainState>());
    }

    [Theory]
    [InlineData("", "MH")]
    [InlineData("   ", "MH")]
    [InlineData("Maharashtra", "")]
    [InlineData("Maharashtra", "   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_or_Code_is_blank_before_checking_the_parent_country(string name, string code)
    {
        var repository = Substitute.For<IStateRepository>();
        var countryRepository = Substitute.For<ICountryRepository>();
        var sut = new StateService(repository, countryRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateStateRequest("country_1", name, code);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainState>());
        // The blank-field guard runs before the parent-country lookup, so it never fires.
        await countryRepository.DidNotReceive().GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Code_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<IStateRepository>();
        var existing = MakeState();
        repository.GetByIdAsync("state_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new StateService(repository, Substitute.For<ICountryRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateStateRequest("country_1", "Maharashtra", "   ", true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("state_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainState>());
    }

    [Fact]
    public async Task CreateAsync_stages_and_commits_once_when_parent_country_is_active()
    {
        var repository = Substitute.For<IStateRepository>();
        var countryRepository = Substitute.For<ICountryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        countryRepository.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(MakeCountry());
        idGenerator.NewId().Returns("state_new");
        var sut = new StateService(repository, countryRepository, unitOfWork, idGenerator);

        var request = new CreateStateRequest("country_1", "Maharashtra", "MH");

        var result = await sut.CreateAsync(request);

        Assert.Equal("state_new", result.Id);
        repository.Received(1).Add(Arg.Is<DomainState>(s => s.Id == "state_new" && s.CountryId == "country_1"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAsync_throws_NotFoundException_when_state_is_missing()
    {
        var repository = Substitute.For<IStateRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainState?)null);
        var sut = new StateService(repository, Substitute.For<ICountryRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateStateRequest("country_1", "Maharashtra", "MH", true);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.UpdateAsync("missing", request));
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<IStateRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeState();
        repository.GetByIdAsync("state_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new StateService(repository, Substitute.For<ICountryRepository>(), unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("state_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainState>(s => s.Id == "state_1" && s.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_state_is_missing()
    {
        var repository = Substitute.For<IStateRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainState?)null);
        var sut = new StateService(repository, Substitute.For<ICountryRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainState>());
    }
}
