using FlexDemy.Application.Common;
using FlexDemy.Application.Tags;
using FlexDemy.Domain.Tags;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Tags;

public class TagServiceTests
{
    private static Tag MakeTag(string id = "tag_1", string name = "Algebra", bool isActive = true) => new()
    {
        Id = id,
        Name = name,
        IsActive = isActive,
    };

    private static TagService CreateSut(
        ITagRepository? repository = null, IUnitOfWork? unitOfWork = null, IIdGenerator? idGenerator = null)
    {
        idGenerator ??= Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("tag_new");

        return new(repository ?? Substitute.For<ITagRepository>(), unitOfWork ?? Substitute.For<IUnitOfWork>(), idGenerator);
    }

    [Fact]
    public async Task CreateAsync_happy_path_persists_and_commits_once()
    {
        var repository = Substitute.For<ITagRepository>();
        repository.GetByNameAsync("Osmosis", Arg.Any<CancellationToken>()).Returns((Tag?)null);
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var sut = CreateSut(repository, unitOfWork);

        var result = await sut.CreateAsync(new CreateTagRequest("Osmosis"));

        Assert.Equal("Osmosis", result.Name);
        Assert.True(result.IsActive);
        repository.Received(1).Add(Arg.Is<Tag>(t => t.Name == "Osmosis" && t.Id == "tag_new"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_blank_name_throws_ValidationException(string blank)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.CreateAsync(new CreateTagRequest(blank)));
    }

    [Fact]
    public async Task CreateAsync_a_name_matching_an_existing_active_tag_case_insensitively_throws_ConflictException()
    {
        var repository = Substitute.For<ITagRepository>();
        repository.GetByNameAsync("algebra", Arg.Any<CancellationToken>()).Returns(MakeTag(name: "Algebra", isActive: true));
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<ConflictException>(() => sut.CreateAsync(new CreateTagRequest("algebra")));
    }

    [Fact]
    public async Task CreateAsync_a_name_matching_an_existing_inactive_tag_also_throws_ConflictException()
    {
        // FR-26: duplicate prevention applies whether the existing tag is active OR deactivated.
        var repository = Substitute.For<ITagRepository>();
        repository.GetByNameAsync("Trigonometry", Arg.Any<CancellationToken>()).Returns(MakeTag(name: "Trigonometry", isActive: false));
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<ConflictException>(() => sut.CreateAsync(new CreateTagRequest("Trigonometry")));
    }

    [Fact]
    public async Task CreateAsync_trims_leading_and_trailing_whitespace_before_the_duplicate_check_and_persistence()
    {
        var repository = Substitute.For<ITagRepository>();
        repository.GetByNameAsync("Osmosis", Arg.Any<CancellationToken>()).Returns((Tag?)null);
        var sut = CreateSut(repository);

        var result = await sut.CreateAsync(new CreateTagRequest("  Osmosis  "));

        // Untrimmed input would have let " Osmosis " and "Osmosis" coexist as
        // visually-identical duplicates -- review finding, 2026-08-11.
        Assert.Equal("Osmosis", result.Name);
        await repository.Received(1).GetByNameAsync("Osmosis", Arg.Any<CancellationToken>());
        repository.Received(1).Add(Arg.Is<Tag>(t => t.Name == "Osmosis"));
    }

    [Fact]
    public async Task UpdateAsync_happy_path_renames_and_toggles_active()
    {
        var repository = Substitute.For<ITagRepository>();
        var existing = MakeTag(id: "tag_1", name: "Algebra", isActive: true);
        repository.GetByIdAsync("tag_1", Arg.Any<CancellationToken>()).Returns(existing);
        repository.GetByNameAsync("Advanced Algebra", Arg.Any<CancellationToken>()).Returns((Tag?)null);
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var sut = CreateSut(repository, unitOfWork);

        var result = await sut.UpdateAsync("tag_1", new UpdateTagRequest("Advanced Algebra", false));

        Assert.Equal("Advanced Algebra", result.Name);
        Assert.False(result.IsActive);
        repository.Received(1).Update(Arg.Is<Tag>(t => t.Name == "Advanced Algebra" && !t.IsActive));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAsync_renaming_to_a_name_used_by_a_different_tag_throws_ConflictException()
    {
        var repository = Substitute.For<ITagRepository>();
        var existing = MakeTag(id: "tag_1", name: "Algebra");
        repository.GetByIdAsync("tag_1", Arg.Any<CancellationToken>()).Returns(existing);
        repository.GetByNameAsync("Geometry", Arg.Any<CancellationToken>()).Returns(MakeTag(id: "tag_2", name: "Geometry"));
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<ConflictException>(() => sut.UpdateAsync("tag_1", new UpdateTagRequest("Geometry", true)));
    }

    [Fact]
    public async Task UpdateAsync_saving_with_its_own_unchanged_name_does_not_throw()
    {
        var repository = Substitute.For<ITagRepository>();
        var existing = MakeTag(id: "tag_1", name: "Algebra", isActive: true);
        repository.GetByIdAsync("tag_1", Arg.Any<CancellationToken>()).Returns(existing);
        // The self-match: GetByNameAsync("Algebra") returns the SAME row being updated.
        repository.GetByNameAsync("Algebra", Arg.Any<CancellationToken>()).Returns(existing);
        var sut = CreateSut(repository);

        var result = await sut.UpdateAsync("tag_1", new UpdateTagRequest("Algebra", false));

        Assert.False(result.IsActive);
    }

    [Fact]
    public async Task UpdateAsync_missing_id_throws_NotFoundException()
    {
        var repository = Substitute.For<ITagRepository>();
        repository.GetByIdAsync("tag_missing", Arg.Any<CancellationToken>()).Returns((Tag?)null);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.UpdateAsync("tag_missing", new UpdateTagRequest("Algebra", true)));
    }

    [Fact]
    public async Task GetAllAsync_maps_every_row()
    {
        var repository = Substitute.For<ITagRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTag("tag_1", "Algebra"), MakeTag("tag_2", "Geometry", isActive: false)]);
        var sut = CreateSut(repository);

        var result = await sut.GetAllAsync();

        Assert.Equal(2, result.Count);
    }
}
