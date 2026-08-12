using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Uses EF Core's InMemory provider rather than a real Postgres instance -- fast, no Docker
// dependency for unit tests.
public class CourseRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    // Story 2.4: GetAllAsync now filters to Published only (AC#5) -- existing tests exercising
    // the public-catalog path default to Published so their pre-existing assertions still hold;
    // Draft-specific behavior gets its own dedicated tests below.
    private static Course MakeCourse(
        string id,
        string gradeTag = "Class 12th",
        string subject = "physics",
        string title = "",
        LifecycleState lifecycleState = LifecycleState.Published) => new()
    {
        Id = id,
        Title = title.Length > 0 ? title : $"Course {id}",
        Subject = subject,
        Level = "Beginner",
        TargetGradeTag = gradeTag,
        InstructorName = "Dr. Rostova",
        LifecycleState = lifecycleState,
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
    public async Task GetByIdAsync_returns_a_Draft_course_unfiltered()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse("course_1", lifecycleState: LifecycleState.Draft));
        await db.SaveChangesAsync();
        var repository = new CourseRepository(db);

        var found = await repository.GetByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Equal(LifecycleState.Draft, found!.LifecycleState);
    }

    [Fact]
    public async Task GetByIdAsync_includes_thumbnails()
    {
        // A shared named InMemory database so the read (second context below) genuinely goes
        // through Include(), not the first context's change tracker still holding the graph
        // in memory from the Add() below.
        var options = new DbContextOptionsBuilder<FlexDemyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        await using (var writeDb = new FlexDemyDbContext(options))
        {
            var course = MakeCourse("course_1");
            course.Thumbnails.Add(new CourseThumbnail { Id = "thumb_1", CourseId = "course_1", Url = "/uploads/course-thumbnails/thumb_1.jpg", Order = 0 });
            writeDb.Courses.Add(course);
            await writeDb.SaveChangesAsync();
        }

        await using var readDb = new FlexDemyDbContext(options);
        var found = await new CourseRepository(readDb).GetByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Single(found!.Thumbnails);
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

    [Fact]
    public async Task GetAllAsync_includes_thumbnails()
    {
        var options = new DbContextOptionsBuilder<FlexDemyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        await using (var writeDb = new FlexDemyDbContext(options))
        {
            var course = MakeCourse("course_1");
            course.Thumbnails.Add(new CourseThumbnail { Id = "thumb_1", CourseId = "course_1", Url = "/uploads/course-thumbnails/thumb_1.jpg", Order = 0 });
            writeDb.Courses.Add(course);
            await writeDb.SaveChangesAsync();
        }

        await using var readDb = new FlexDemyDbContext(options);
        var all = await new CourseRepository(readDb).GetAllAsync(null, null, null);

        Assert.Single(all.Single().Thumbnails);
    }

    [Fact]
    public async Task GetAllAsync_excludes_non_Published_courses()
    {
        await using var db = NewContext();
        db.Courses.AddRange(
            MakeCourse("course_published", lifecycleState: LifecycleState.Published),
            MakeCourse("course_draft", lifecycleState: LifecycleState.Draft),
            MakeCourse("course_in_review", lifecycleState: LifecycleState.InReview));
        await db.SaveChangesAsync();
        var repository = new CourseRepository(db);

        var all = await repository.GetAllAsync(null, null, null);

        Assert.Equal(["course_published"], all.Select(c => c.Id));
    }

    [Fact]
    public async Task GetAllAsync_search_matches_a_literal_wildcard_character_instead_of_a_pattern()
    {
        // Story 2.4/Story 1.9 precedent: EF.Functions.ILike(c.Title, $"%{search}%") would treat
        // a caller-supplied '%'/'_' as a SQL LIKE wildcard instead of a literal character. The
        // ToLower().Contains() fix has no pattern metacharacters, so a literal '%' in the title
        // must match a literal '%' in the search term, not "anything".
        await using var db = NewContext();
        db.Courses.AddRange(
            MakeCourse("course_1", title: "Save 50% on Physics"),
            MakeCourse("course_2", title: "Regular Physics Course"));
        await db.SaveChangesAsync();
        var repository = new CourseRepository(db);

        var results = await repository.GetAllAsync(null, "50%", null);

        Assert.Equal(["course_1"], results.Select(c => c.Id));
    }

    [Fact]
    public async Task GetDraftByIdAsync_returns_a_Draft_with_its_thumbnails_populated()
    {
        await using var db = NewContext();
        var course = MakeCourse("course_1", lifecycleState: LifecycleState.Draft);
        course.Thumbnails.Add(new CourseThumbnail { Id = "thumb_1", CourseId = "course_1", Url = "/uploads/course-thumbnails/thumb_1.jpg", Order = 0 });
        db.Courses.Add(course);
        await db.SaveChangesAsync();
        var repository = new CourseRepository(db);

        var found = await repository.GetDraftByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Single(found!.Thumbnails);
        Assert.Equal("thumb_1", found.Thumbnails[0].Id);
    }

    [Fact]
    public async Task GetDraftByIdAsync_round_trips_tag_ids_and_taxonomy_fields()
    {
        var options = new DbContextOptionsBuilder<FlexDemyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        await using (var writeDb = new FlexDemyDbContext(options))
        {
            var course = MakeCourse("course_1", lifecycleState: LifecycleState.Draft);
            course.TagIds = ["tag_physics", "tag_quantum"];
            course.CountryId = "country_in";
            course.StateId = "state_mh";
            course.CityId = "city_mumbai";
            course.BoardId = "board_mh_state";
            course.ClassLevelId = "class_10";
            course.SubjectId = "subject_physics";
            writeDb.Courses.Add(course);
            await writeDb.SaveChangesAsync();
        }

        await using var readDb = new FlexDemyDbContext(options);
        var found = await new CourseRepository(readDb).GetDraftByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Equal(["tag_physics", "tag_quantum"], found!.TagIds);
        Assert.Equal("country_in", found.CountryId);
        Assert.Equal("state_mh", found.StateId);
        Assert.Equal("city_mumbai", found.CityId);
        Assert.Equal("board_mh_state", found.BoardId);
        Assert.Equal("class_10", found.ClassLevelId);
        Assert.Equal("subject_physics", found.SubjectId);
    }

    [Fact]
    public async Task GetDraftByIdAsync_round_trips_a_partial_taxonomy_selection()
    {
        // Mirrors a tutor who's only chosen Country so far -- State/City/Board/ClassLevel/
        // Subject are genuinely null, not just unset-in-the-test.
        var options = new DbContextOptionsBuilder<FlexDemyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        await using (var writeDb = new FlexDemyDbContext(options))
        {
            var course = MakeCourse("course_1", lifecycleState: LifecycleState.Draft);
            course.CountryId = "country_in";
            writeDb.Courses.Add(course);
            await writeDb.SaveChangesAsync();
        }

        await using var readDb = new FlexDemyDbContext(options);
        var found = await new CourseRepository(readDb).GetDraftByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Empty(found!.TagIds);
        Assert.Equal("country_in", found.CountryId);
        Assert.Null(found.StateId);
        Assert.Null(found.CityId);
        Assert.Null(found.BoardId);
        Assert.Null(found.ClassLevelId);
        Assert.Null(found.SubjectId);
    }

    [Fact]
    public async Task GetByIdAsync_round_trips_tag_ids_and_taxonomy_fields()
    {
        // Task 5's own claim covers both GetDraftByIdAsync (above) and GetByIdAsync -- these
        // scalar/array columns aren't navigation properties, so no .Include() difference
        // between the two methods applies to them, but this closes the literal claim precisely.
        var options = new DbContextOptionsBuilder<FlexDemyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        await using (var writeDb = new FlexDemyDbContext(options))
        {
            var course = MakeCourse("course_1", lifecycleState: LifecycleState.Draft);
            course.TagIds = ["tag_physics"];
            course.CountryId = "country_in";
            writeDb.Courses.Add(course);
            await writeDb.SaveChangesAsync();
        }

        await using var readDb = new FlexDemyDbContext(options);
        var found = await new CourseRepository(readDb).GetByIdAsync("course_1");

        Assert.NotNull(found);
        Assert.Equal(["tag_physics"], found!.TagIds);
        Assert.Equal("country_in", found.CountryId);
    }

    [Fact]
    public void TagIds_uses_HasDefaultValueSql_not_HasDefaultValue()
    {
        // Regression guard for a real bug found via live-stack testing (Story 2.5): a mutable
        // List<string> passed to HasDefaultValue() is a NEW instance on every OnModelCreating
        // call, so EF's snapshot comparer can never recognize it as unchanged -- the app fails
        // EF Core's own startup PendingModelChangesWarning check on every single run. This test
        // can't reproduce that startup crash directly (this repo's tests never boot a real
        // WebApplication), but it does directly assert the specific configuration that caused
        // it, so a future edit reintroducing HasDefaultValue(new List<string>()) fails here
        // immediately instead of only failing at deploy time.
        using var db = NewContext();
        var property = db.Model.FindEntityType(typeof(Course))!.FindProperty(nameof(Course.TagIds))!;

        Assert.Equal("'{}'", property.GetDefaultValueSql());
        Assert.Null(property.GetDefaultValue());
    }

    [Fact]
    public async Task GetDraftByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new CourseRepository(db);

        Assert.Null(await repository.GetDraftByIdAsync("does_not_exist"));
    }
}
