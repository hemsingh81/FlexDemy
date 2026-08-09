using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.City;
using FlexDemy.Application.MasterData.State;
using NSubstitute;
using Xunit;
using DomainCity = FlexDemy.Domain.MasterData.City;

namespace FlexDemy.Application.Tests.MasterData.City;

// Soft-delete coverage only (plan §2 phase): Create/Update parent-validation is already
// exercised for the identical pattern by BoardServiceTests/StateServiceTests.
public class CityServiceTests
{
    private static DomainCity MakeCity(string id = "city_1") => new()
    {
        Id = id,
        StateId = "state_1",
        Name = "Mumbai",
    };

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_is_blank_before_checking_the_parent_state(string name)
    {
        var repository = Substitute.For<ICityRepository>();
        var stateRepository = Substitute.For<IStateRepository>();
        var sut = new CityService(repository, stateRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateCityRequest("state_1", name);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainCity>());
        await stateRepository.DidNotReceive().GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Name_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<ICityRepository>();
        var existing = MakeCity();
        repository.GetByIdAsync("city_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new CityService(repository, Substitute.For<IStateRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateCityRequest("state_1", "   ", true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("city_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainCity>());
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<ICityRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeCity();
        repository.GetByIdAsync("city_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new CityService(repository, Substitute.For<IStateRepository>(), unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("city_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainCity>(c => c.Id == "city_1" && c.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_city_is_missing()
    {
        var repository = Substitute.For<ICityRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainCity?)null);
        var sut = new CityService(repository, Substitute.For<IStateRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainCity>());
    }
}
