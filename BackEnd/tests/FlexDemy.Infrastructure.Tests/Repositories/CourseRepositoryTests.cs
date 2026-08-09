using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Uses EF Core's InMemory provider rather than a real Postgres instance -- fast, no Docker
// dependency for unit tests. GetAllAsync's `search` filter uses EF.Functions.ILike, which is
// Npgsql-specific and can't translate under InMemory, so that path isn't covered here; it's a
// straightforward LINQ predicate exercised in integration/manual testing against real Postgres.
public class CourseRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Course MakeCourse(string id, string gradeTag = "Class 12th", string subject = "physics") => new()
    {
        Id = id,
        Title = $"Course {id}",
        Subject = subject,
        Level = "Beginner",
        TargetGradeTag = gradeTag,
        InstructorName = "Dr. Rostova",
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_course()
    {
        await using var db = NewContext();
        var repository = new CourseRepository(db);

        repository.Add(MakeCourse("course_1"));
        await db.SaveChangesAsync();

        var found = await repository.GetByIdAsync("course_1");
        Assert.NotNull(found);
        Assert.Equal("Course course_1", found!.Title);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new CourseRepository(db);

        Assert.Null(await repository.GetByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task GetAllAsync_filters_by_grade_tag_and_subject()
    {
        await using var db = NewContext();
        db.Courses.AddRange(
            MakeCourse("course_1", gradeTag: "Class 10th", subject: "physics"),
            MakeCourse("course_2", gradeTag: "Class 12th", subject: "physics"),
            MakeCourse("course_3", gradeTag: "Class 12th", subject: "stem_math"));
        await db.SaveChangesAsync();
        var repository = new CourseRepository(db);

        var byGrade = await repository.GetAllAsync("Class 12th", null, null);
        Assert.Equal(["course_2", "course_3"], byGrade.Select(c => c.Id).Order());

        var bySubject = await repository.GetAllAsync(null, null, "stem_math");
        Assert.Equal(["course_3"], bySubject.Select(c => c.Id));
    }
}
