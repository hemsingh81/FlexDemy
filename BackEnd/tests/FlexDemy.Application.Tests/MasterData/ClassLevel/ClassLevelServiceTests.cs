using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.ClassLevel;
using FlexDemy.Application.MasterData.Subject;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Xunit;
using DomainClassLevel = FlexDemy.Domain.MasterData.ClassLevel;
using DomainSubject = FlexDemy.Domain.MasterData.Subject;

namespace FlexDemy.Application.Tests.MasterData.ClassLevel;

// ClassLevel validates every referenced Subject exists and is active via ISubjectService (never
// ISubjectRepository directly -- AD-12), the same per-entity validation shape State uses for its
// parent Country (StateServiceTests.cs) and City/Board use for their parent State.
public class ClassLevelServiceTests
{
    private static DomainClassLevel MakeClassLevel(string id = "cl_1") => new()
    {
        Id = id,
        Name = "Class 10th",
        SortOrder = 13,
    };

    private static SubjectDto MakeSubjectDto(string id, bool isActive = true) =>
        new(id, "Mathematics", null, isActive);

    [Fact]
    public async Task CreateAsync_validates_every_subject_id_and_stages_the_entity_when_all_are_active()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("cl_new");
        subjectService.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(MakeSubjectDto("subj_1"));
        subjectService.GetByIdAsync("subj_2", Arg.Any<CancellationToken>()).Returns(MakeSubjectDto("subj_2"));
        var sut = new ClassLevelService(repository, subjectService, unitOfWork, idGenerator);

        var request = new CreateClassLevelRequest("Class 10th", 13, ["subj_1", "subj_2"]);

        var result = await sut.CreateAsync(request);

        Assert.Equal(["subj_1", "subj_2"], result.SubjectIds);
        repository.Received(1).Add(Arg.Is<DomainClassLevel>(c => c.Id == "cl_new" && c.SubjectIds.SequenceEqual(new[] { "subj_1", "subj_2" })));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateAsync_allows_an_empty_subject_list_for_class_levels_with_no_formal_subjects()
    {
        // Pre-Nursery..UKG intentionally seed with an empty SubjectIds list (ClassLevelSeedData.cs)
        // -- validation must not require at least one subject the way Profile's does.
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("cl_new");
        var sut = new ClassLevelService(repository, subjectService, unitOfWork, idGenerator);

        var request = new CreateClassLevelRequest("Nursery", 1, []);

        var result = await sut.CreateAsync(request);

        Assert.Empty(result.SubjectIds);
        await subjectService.DidNotReceive().GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_throws_ValidationException_when_Name_is_blank_before_validating_subjects(string name)
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        var sut = new ClassLevelService(repository, subjectService, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateClassLevelRequest(name, 13, ["subj_1"]);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainClassLevel>());
        await subjectService.DidNotReceive().GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAsync_throws_ValidationException_when_Name_is_blank_and_does_not_stage_a_change()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var existing = MakeClassLevel();
        repository.GetByIdAsync("cl_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new ClassLevelService(repository, Substitute.For<ISubjectService>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateClassLevelRequest("   ", 13, true, []);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("cl_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainClassLevel>());
    }

    [Fact]
    public async Task CreateAsync_throws_NotFoundException_when_a_referenced_subject_does_not_exist()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        subjectService.GetByIdAsync("missing_subject", Arg.Any<CancellationToken>())
            .Throws(new NotFoundException(nameof(DomainSubject), "missing_subject"));
        var sut = new ClassLevelService(repository, subjectService, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateClassLevelRequest("Class 10th", 13, ["missing_subject"]);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainClassLevel>());
    }

    [Fact]
    public async Task CreateAsync_throws_ValidationException_when_a_referenced_subject_is_inactive()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        subjectService.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(MakeSubjectDto("subj_1", isActive: false));
        var sut = new ClassLevelService(repository, subjectService, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new CreateClassLevelRequest("Class 10th", 13, ["subj_1"]);

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(request));
        repository.DidNotReceive().Add(Arg.Any<DomainClassLevel>());
    }

    [Fact]
    public async Task UpdateAsync_validates_subject_ids_before_applying_the_update()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var subjectService = Substitute.For<ISubjectService>();
        var existing = MakeClassLevel();
        repository.GetByIdAsync("cl_1", Arg.Any<CancellationToken>()).Returns(existing);
        subjectService.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(MakeSubjectDto("subj_1", isActive: false));
        var sut = new ClassLevelService(repository, subjectService, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var request = new UpdateClassLevelRequest("Class 10th", 13, true, ["subj_1"]);

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateAsync("cl_1", request));
        repository.DidNotReceive().Update(Arg.Any<DomainClassLevel>());
    }

    [Fact]
    public async Task DeleteAsync_sets_IsDeleted_stages_the_change_and_commits_once()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeClassLevel();
        repository.GetByIdAsync("cl_1", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = new ClassLevelService(repository, Substitute.For<ISubjectService>(), unitOfWork, Substitute.For<IIdGenerator>());

        await sut.DeleteAsync("cl_1");

        Assert.True(existing.IsDeleted);
        repository.Received(1).Update(Arg.Is<DomainClassLevel>(c => c.Id == "cl_1" && c.IsDeleted));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_when_the_class_level_is_missing()
    {
        var repository = Substitute.For<IClassLevelRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((DomainClassLevel?)null);
        var sut = new ClassLevelService(repository, Substitute.For<ISubjectService>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.DeleteAsync("missing"));
        repository.DidNotReceive().Update(Arg.Any<DomainClassLevel>());
    }
}
