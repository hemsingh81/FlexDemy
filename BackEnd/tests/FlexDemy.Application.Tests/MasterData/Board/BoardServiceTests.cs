using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Board;
using FlexDemy.Application.MasterData.State;
using NSubstitute;
using Xunit;
using DomainBoard = FlexDemy.Domain.MasterData.Board;
using DomainState = FlexDemy.Domain.MasterData.State;

namespace FlexDemy.Application.Tests.MasterData.Board;

public class BoardServiceTests
{
    private static DomainState MakeState(bool isActive = true) => new()
    {
        Id = "state_1",
        CountryId = "country_1",
        Name = "Maharashtra",
        Code = "MH",
        IsActive = isActive,
    };

    [Fact]
    public async Task CreateAsync_skips_parent_validation_when_StateId_is_null()
    {
        var repository = Substitute.For<IBoardRepository>();
        var stateRepository = Substitute.For<IStateRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("board_new");
        var sut = new BoardService(repository, stateRepository, unitOfWork, idGenerator);

        var request = new CreateBoardRequest("CBSE", "CBSE", null);

        var result = await sut.CreateAsync(request);

        Assert.Equal("board_new", result.Id);
        Assert.Null(result.StateId);
        await stateRepository.DidNotReceive().GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        repository.Received(1).Add(Arg.Is<DomainBoard>(b => b.Id == "board_new" && b.StateId == null));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateAsync_throws_ValidationException_when_parent_state_is_inactive()
    {
        var repository = Substitute.For<IBoardRepository>();
        var stateRepository = Substitute.For<IStateRepository>();
        stateRepository.GetByIdAsync("state_1", Arg.Any<CancellationToken>()).Returns(MakeState(isActive: false));
        var sut = new BoardService(repository, stateRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateBoardRequest("Maharashtra State Board", "MHSB", "state_1");

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainBoard>());
    }

    [Fact]
    public async Task CreateAsync_throws_NotFoundException_when_parent_state_is_missing()
    {
        var repository = Substitute.For<IBoardRepository>();
        var stateRepository = Substitute.For<IStateRepository>();
        stateRepository.GetByIdAsync("missing_state", Arg.Any<CancellationToken>()).Returns((DomainState?)null);
        var sut = new BoardService(repository, stateRepository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateBoardRequest("Some State Board", "SSB", "missing_state");

        await Assert.ThrowsAsync<NotFoundException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainBoard>());
    }

    [Theory]
    [InlineData("", "CBSE")]
    [InlineData("   ", "CBSE")]
    [InlineData("CBSE", "")]
    [InlineData("CBSE", "   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_or_Code_is_blank_even_with_no_parent_state(string name, string code)
    {
        var repository = Substitute.For<IBoardRepository>();
        var sut = new BoardService(repository, Substitute.For<IStateRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateBoardRequest(name, code, null);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainBoard>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Code_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<IBoardRepository>();
        var existing = new DomainBoard { Id = "board_1", Name = "CBSE", Code = "CBSE", StateId = null };
        repository.GetByIdAsync("board_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new BoardService(repository, Substitute.For<IStateRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateBoardRequest("CBSE", "   ", null, true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("board_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainBoard>());
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<IBoardRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = new DomainBoard { Id = "board_1", Name = "CBSE", Code = "CBSE", StateId = null };
        repository.GetByIdAsync("board_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new BoardService(repository, Substitute.For<IStateRepository>(), unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("board_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainBoard>(b => b.Id == "board_1" && b.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_board_is_missing()
    {
        var repository = Substitute.For<IBoardRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainBoard?)null);
        var sut = new BoardService(repository, Substitute.For<IStateRepository>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainBoard>());
    }
}
