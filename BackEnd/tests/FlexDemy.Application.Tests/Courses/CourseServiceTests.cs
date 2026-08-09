using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class CourseServiceTests
{
    private static Course MakeCourse(string id = "course_1") => new()
    {
        Id = id,
        Title = "Quantum Foundations",
        Subject = "physics",
        Level = "Beginner",
        TargetGradeTag = "Class 12th",
        InstructorName = "Dr. Rostova",
    };

    [Fact]
    public async Task GetCourseByIdAsync_returns_the_mapped_dto_when_found()
    {
        var repository = Substitute.For<ICourseRepository>();
        repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourse());
        var sut = new CourseService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var result = await sut.GetCourseByIdAsync("course_1");

        Assert.Equal("course_1", result.Id);
        Assert.Equal("Quantum Foundations", result.Title);
    }

    [Fact]
    public async Task GetCourseByIdAsync_throws_NotFoundException_when_missing()
    {
        var repository = Substitute.For<ICourseRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);
        var sut = new CourseService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.GetCourseByIdAsync("missing"));
    }

    [Fact]
    public async Task CreateCourseAsync_assigns_an_id_stages_the_entity_and_commits_once()
    {
        var repository = Substitute.For<ICourseRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("course_new");
        var sut = new CourseService(repository, unitOfWork, idGenerator);

        var request = new CreateCourseRequest(
            "New Course", "short", "full", "physics", "Beginner", "Class 12th",
            null, "Dr. Rostova", null, null, 5, null, null);

        var result = await sut.CreateCourseAsync(request);

        Assert.Equal("course_new", result.Id);
        repository.Received(1).Add(Arg.Is<Course>(c => c.Id == "course_new"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
