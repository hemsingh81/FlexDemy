using FlexDemy.Domain.Tags;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class TagRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Tag MakeTag(string id, string name, bool isActive = true) => new()
    {
        Id = id,
        Name = name,
        IsActive = isActive,
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.Tags.AddRange(MakeTag("tag_1", "Algebra"), MakeTag("tag_2", "Geometry"));
        await db.SaveChangesAsync();
        var repository = new TagRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetByIdAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.Tags.Add(MakeTag("tag_1", "Algebra"));
        await db.SaveChangesAsync();
        var repository = new TagRepository(db);

        var found = await repository.GetByIdAsync("tag_1");

        Assert.NotNull(found);
        Assert.Equal("Algebra", found!.Name);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new TagRepository(db);

        Assert.Null(await repository.GetByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task Update_persists_changes_made_to_a_tracked_entity()
    {
        await using var db = NewContext();
        var repository = new TagRepository(db);
        var tag = MakeTag("tag_1", "Algebra");
        db.Tags.Add(tag);
        await db.SaveChangesAsync();

        tag.IsActive = false;
        repository.Update(tag);
        await db.SaveChangesAsync();

        var found = await repository.GetByIdAsync("tag_1");
        Assert.False(found!.IsActive);
    }

    [Fact]
    public async Task GetByNameAsync_matches_case_insensitively()
    {
        await using var db = NewContext();
        db.Tags.Add(MakeTag("tag_1", "Algebra"));
        await db.SaveChangesAsync();
        var repository = new TagRepository(db);

        var found = await repository.GetByNameAsync("algebra");

        Assert.NotNull(found);
        Assert.Equal("tag_1", found!.Id);
    }

    [Fact]
    public async Task GetByNameAsync_returns_null_for_a_genuinely_different_name()
    {
        await using var db = NewContext();
        db.Tags.Add(MakeTag("tag_1", "Algebra"));
        await db.SaveChangesAsync();
        var repository = new TagRepository(db);

        Assert.Null(await repository.GetByNameAsync("Geometry"));
    }

    [Fact]
    public async Task GetByNameAsync_treats_percent_and_underscore_as_literal_characters_not_wildcards()
    {
        // Regression test (review finding, 2026-08-11): EF.Functions.ILike previously treated an
        // unescaped '%'/'_' in the searched name as a SQL LIKE wildcard, causing a genuinely
        // distinct name to false-positive match. A plain lower()-comparison has no such risk.
        await using var db = NewContext();
        db.Tags.Add(MakeTag("tag_1", "Grade X9"));
        await db.SaveChangesAsync();
        var repository = new TagRepository(db);

        // "_" would match any single character under LIKE semantics, so "Grade_9" would
        // wrongly match "Grade X9" if wildcards were still active.
        Assert.Null(await repository.GetByNameAsync("Grade_9"));
    }
}
