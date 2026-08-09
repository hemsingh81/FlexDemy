using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Subject;
using NSubstitute;
using Xunit;
using DomainSubject = FlexDemy.Domain.MasterData.Subject;

namespace FlexDemy.Application.Tests.MasterData.Subject;

// Soft-delete coverage only (plan §2 phase): Subject has no parent to validate, so Create/Update
// are already fully exercised by the controller/mapper round-trip; this file adds the new
// DeleteAsync behavior.
public class SubjectServiceTests
{
    private static DomainSubject MakeSubject(string id = "subj_1") => new()
    {
        Id = id,
        Name = "Mathematics",
        Stream = null,
    };

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_is_blank(string name)
    {
        var repository = Substitute.For<ISubjectRepository>();
        var sut = new SubjectService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateSubjectRequest(name, null);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainSubject>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Name_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<ISubjectRepository>();
        var existing = MakeSubject();
        repository.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new SubjectService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateSubjectRequest("   ", null, true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("subj_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainSubject>());
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<ISubjectRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeSubject();
        repository.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new SubjectService(repository, unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("subj_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainSubject>(s => s.Id == "subj_1" && s.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_subject_is_missing()
    {
        var repository = Substitute.For<ISubjectRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainSubject?)null);
        var sut = new SubjectService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainSubject>());
    }
}
