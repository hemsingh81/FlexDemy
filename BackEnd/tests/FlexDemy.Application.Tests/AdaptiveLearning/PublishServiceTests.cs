using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

// Publish is now a single, immediate, synchronous transition -- no per-topic pre-generation batch
// (PublishBatch/PublishBatchItem, removed along with the Chapter/Topic/Subtopic tree).
public class PublishServiceTests
{
    private sealed record Sut(PublishService Service, ICourseService CourseService, IVersionService VersionService);

    private static Sut MakeSut()
    {
        var courseService = Substitute.For<ICourseService>();
        var versionService = Substitute.For<IVersionService>();
        var service = new PublishService(courseService, versionService);
        return new Sut(service, courseService, versionService);
    }

    private static CourseDto MakeCourseDto(string lifecycleState) => new(
        Id: "course_1", Title: "Quantum Foundations", ShortDescription: "", FullDescription: "", Subject: "physics",
        Level: "Beginner", TargetGradeTag: "Class 12th", Tags: [], InstructorName: "Dr. Rostova", InstructorRole: null,
        InstructorAvatar: null, Rating: 0, EnrolledCount: 0, EstimatedHours: 0, ThumbnailUrl: null, BadgeIcon: null,
        LifecycleState: lifecycleState, Thumbnails: [], TagIds: [], CountryId: null, StateId: null, CityId: null,
        BoardId: null, ClassLevelId: null, SubjectId: null);

    // -- PublishAsync --------------------------------------------------------------------------

    [Fact]
    public async Task PublishAsync_throws_ValidationException_when_the_course_is_not_ReviewConfirmed()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.Draft)));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.PublishAsync("course_1"));

        await sut.VersionService.DidNotReceiveWithAnyArgs().CreateSnapshotAsync(default!, default);
        await sut.CourseService.DidNotReceiveWithAnyArgs().MarkPublishedAsync(default!, default);
    }

    [Fact]
    public async Task PublishAsync_snapshots_then_marks_the_course_Published()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        var callOrder = new List<string>();
        sut.VersionService.When(v => v.CreateSnapshotAsync("course_1", Arg.Any<CancellationToken>())).Do(_ => callOrder.Add("snapshot"));
        sut.CourseService.When(c => c.MarkPublishedAsync("course_1", Arg.Any<CancellationToken>())).Do(_ => callOrder.Add("publish"));

        await sut.Service.PublishAsync("course_1");

        await sut.VersionService.Received(1).CreateSnapshotAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
        // The snapshot must capture the ReviewConfirmed course's current content before it's
        // marked Published, not whatever's there afterward.
        Assert.Equal(["snapshot", "publish"], callOrder);
    }

    // -- GetStatusAsync -------------------------------------------------------------------------

    [Fact]
    public async Task GetStatusAsync_returns_the_courses_current_LifecycleState()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));

        var status = await sut.Service.GetStatusAsync("course_1");

        Assert.Equal(nameof(LifecycleState.ReviewConfirmed), status.LifecycleState);
    }
}
