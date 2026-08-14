using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

// Story 3.8/Task 5: the tutor-facing publish trigger + checklist read.
public class PublishServiceTests
{
    private sealed record Sut(
        PublishService Service,
        ICourseService CourseService,
        IContentTreeRepository ContentTreeRepository,
        IPublishBatchRepository Repository,
        IVersionService VersionService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork,
        IPublishNodeContentJobEnqueuer JobEnqueuer,
        ICorrelationIdAccessor CorrelationIdAccessor);

    private static Sut MakeSut()
    {
        var courseService = Substitute.For<ICourseService>();
        var contentTreeRepository = Substitute.For<IContentTreeRepository>();
        var repository = Substitute.For<IPublishBatchRepository>();
        var versionService = Substitute.For<IVersionService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var ids = new Queue<string>(Enumerable.Range(1, 50).Select(i => $"id_{i}"));
        idGenerator.NewId().Returns(_ => ids.Dequeue());
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var jobEnqueuer = Substitute.For<IPublishNodeContentJobEnqueuer>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();

        var service = new PublishService(courseService, contentTreeRepository, repository, versionService, idGenerator, unitOfWork, jobEnqueuer, correlationIdAccessor);
        return new Sut(service, courseService, contentTreeRepository, repository, versionService, idGenerator, unitOfWork, jobEnqueuer, correlationIdAccessor);
    }

    private static CourseDto MakeCourseDto(string lifecycleState) => new(
        Id: "course_1", Title: "Quantum Foundations", ShortDescription: "", FullDescription: "", Subject: "physics",
        Level: "Beginner", TargetGradeTag: "Class 12th", Tags: [], InstructorName: "Dr. Rostova", InstructorRole: null,
        InstructorAvatar: null, Rating: 0, EnrolledCount: 0, EstimatedHours: 0, ThumbnailUrl: null, BadgeIcon: null,
        LifecycleState: lifecycleState, Thumbnails: [], TagIds: [], CountryId: null, StateId: null, CityId: null,
        BoardId: null, ClassLevelId: null, SubjectId: null);

    private static Chapter MakeChapter(string id, params Topic[] topics) => new()
    {
        Id = id,
        CourseId = "course_1",
        Title = $"Chapter {id}",
        Topics = topics.ToList(),
    };

    private static Topic MakeTopic(string id, NodeConfirmation confirmation, params Subtopic[] subtopics) => new()
    {
        Id = id,
        ChapterId = "chapter_1",
        Title = $"Topic {id}",
        Confirmation = confirmation,
        Subtopics = subtopics.ToList(),
    };

    private static Subtopic MakeSubtopic(string id, NodeConfirmation confirmation) => new()
    {
        Id = id,
        TopicId = "topic_1",
        Title = $"Subtopic {id}",
        Confirmation = confirmation,
    };

    // -- PublishAsync --------------------------------------------------------------------------

    [Fact]
    public async Task PublishAsync_throws_ValidationException_when_the_course_is_not_ReviewConfirmed()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.Draft)));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.PublishAsync("course_1"));
    }

    [Fact]
    public async Task PublishAsync_throws_ValidationException_when_a_batch_is_already_running_for_this_course()
    {
        // Code-review patch: LifecycleState stays ReviewConfirmed for the whole publishing
        // duration by design, so the ReviewConfirmed check alone can't reject a second trigger
        // while a batch is already in flight -- this guard is what actually does.
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new PublishBatch { Id = "batch_1", CourseId = "course_1", TotalNodes = 3, Remaining = 2 });

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.PublishAsync("course_1"));

        sut.Repository.DidNotReceiveWithAnyArgs().AddBatch(default!);
    }

    [Fact]
    public async Task PublishAsync_is_allowed_once_the_previous_batch_for_this_course_has_finished()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new PublishBatch { Id = "batch_1", CourseId = "course_1", TotalNodes = 3, Remaining = 0 });
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.PublishAsync("course_1");

        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PublishAsync_creates_a_batch_and_one_item_per_confirmed_node_then_enqueues_each_after_commit()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        var confirmedSubtopic = MakeSubtopic("subtopic_1", NodeConfirmation.Confirmed);
        var unconfirmedSubtopic = MakeSubtopic("subtopic_2", NodeConfirmation.Unconfirmed);
        var confirmedTopic = MakeTopic("topic_1", NodeConfirmation.Confirmed, confirmedSubtopic, unconfirmedSubtopic);
        var unconfirmedTopic = MakeTopic("topic_2", NodeConfirmation.Unconfirmed);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([MakeChapter("chapter_1", confirmedTopic, unconfirmedTopic)]);

        var callOrder = new List<string>();
        sut.UnitOfWork.When(u => u.SaveChangesAsync(Arg.Any<CancellationToken>())).Do(_ => callOrder.Add("save"));
        sut.JobEnqueuer.When(j => j.Enqueue(Arg.Any<string>(), Arg.Any<string?>())).Do(call => callOrder.Add($"enqueue:{call.ArgAt<string>(0)}"));

        await sut.Service.PublishAsync("course_1");

        sut.Repository.Received(1).AddBatch(Arg.Is<PublishBatch>(b => b.CourseId == "course_1" && b.TotalNodes == 2 && b.Remaining == 2));
        sut.Repository.Received(1).AddItem(Arg.Is<PublishBatchItem>(i => i.TopicId == "topic_1" && i.SubtopicId == null && i.Status == PublishItemStatus.Queued));
        sut.Repository.Received(1).AddItem(Arg.Is<PublishBatchItem>(i => i.TopicId == null && i.SubtopicId == "subtopic_1" && i.Status == PublishItemStatus.Queued));
        sut.Repository.DidNotReceive().AddItem(Arg.Is<PublishBatchItem>(i => i.SubtopicId == "subtopic_2"));
        sut.Repository.DidNotReceive().AddItem(Arg.Is<PublishBatchItem>(i => i.TopicId == "topic_2"));

        // Enqueue only happens after the commit -- a job started before its own row exists would
        // fail its own GetItemByIdAsync lookup.
        Assert.Equal("save", callOrder[0]);
        Assert.Equal(2, callOrder.Count(c => c.StartsWith("enqueue:")));
    }

    // Code-review patch: Story 4.1's own design point for this loop ("read once... every
    // node-generation job... shares the same Correlation ID") was previously untested -- the
    // existing call-order test above only captured item ids, never the correlationId argument, and
    // the accessor was substituted but never exposed on Sut for a test to configure/assert on.
    [Fact]
    public async Task PublishAsync_forwards_the_identical_correlation_id_to_every_enqueued_job_in_the_batch()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns("corr-xyz");
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        var confirmedTopic1 = MakeTopic("topic_1", NodeConfirmation.Confirmed);
        var confirmedTopic2 = MakeTopic("topic_2", NodeConfirmation.Confirmed);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([MakeChapter("chapter_1", confirmedTopic1, confirmedTopic2)]);
        var capturedCorrelationIds = new List<string?>();
        sut.JobEnqueuer.When(j => j.Enqueue(Arg.Any<string>(), Arg.Any<string?>())).Do(call => capturedCorrelationIds.Add(call.ArgAt<string?>(1)));

        await sut.Service.PublishAsync("course_1");

        Assert.Equal(2, capturedCorrelationIds.Count);
        Assert.All(capturedCorrelationIds, id => Assert.Equal("corr-xyz", id));
    }

    [Fact]
    public async Task PublishAsync_with_zero_confirmed_nodes_finalizes_immediately_without_creating_a_batch()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.PublishAsync("course_1");

        sut.Repository.DidNotReceiveWithAnyArgs().AddBatch(default!);
        sut.Repository.DidNotReceiveWithAnyArgs().AddItem(default!);
        sut.JobEnqueuer.DidNotReceiveWithAnyArgs().Enqueue(default!, default!);
        await sut.VersionService.Received(1).CreateSnapshotAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
    }

    // -- GetStatusAsync -------------------------------------------------------------------------

    [Fact]
    public async Task GetStatusAsync_returns_a_null_checklist_and_IsPublishing_false_when_no_batch_exists_yet()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.Draft)));
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns((PublishBatch?)null);

        var status = await sut.Service.GetStatusAsync("course_1");

        Assert.Equal(nameof(LifecycleState.Draft), status.LifecycleState);
        Assert.False(status.IsPublishing);
        Assert.Null(status.Checklist);
    }

    [Fact]
    public async Task GetStatusAsync_IsPublishing_reflects_whether_Remaining_is_still_greater_than_zero()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new PublishBatch { Id = "batch_1", CourseId = "course_1", TotalNodes = 2, Remaining = 1 });
        sut.Repository.GetItemsByBatchIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns([]);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        var status = await sut.Service.GetStatusAsync("course_1");

        Assert.True(status.IsPublishing);
    }

    [Fact]
    public async Task GetStatusAsync_includes_a_chapter_row_only_when_it_has_at_least_one_batch_item_under_it()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        var topicWithItem = MakeTopic("topic_1", NodeConfirmation.Confirmed);
        var topicWithoutItem = MakeTopic("topic_2", NodeConfirmation.Unconfirmed);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([
            MakeChapter("chapter_with_item", topicWithItem),
            MakeChapter("chapter_without_item", topicWithoutItem),
        ]);
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new PublishBatch { Id = "batch_1", CourseId = "course_1", TotalNodes = 1, Remaining = 0 });
        sut.Repository.GetItemsByBatchIdAsync("batch_1", Arg.Any<CancellationToken>())
            .Returns([new PublishBatchItem { Id = "item_1", BatchId = "batch_1", TopicId = "topic_1", Status = PublishItemStatus.Done, ProgressText = "Drill-Down + Ways generated" }]);

        var status = await sut.Service.GetStatusAsync("course_1");

        Assert.NotNull(status.Checklist);
        Assert.Contains(status.Checklist!, r => r.NodeId == "chapter_with_item" && r.NodeKind == "chapter");
        Assert.DoesNotContain(status.Checklist!, r => r.NodeId == "chapter_without_item");
        Assert.Contains(status.Checklist!, r => r.NodeId == "topic_1" && r.NodeKind == "topic" && r.StatusKind == "done");
        Assert.DoesNotContain(status.Checklist!, r => r.NodeId == "topic_2");
    }

    [Theory]
    [InlineData(PublishItemStatus.Queued, "pending")]
    [InlineData(PublishItemStatus.InProgress, "inProgress")]
    [InlineData(PublishItemStatus.Done, "done")]
    [InlineData(PublishItemStatus.Failed, "failed")]
    public async Task GetStatusAsync_maps_each_PublishItemStatus_to_its_frontend_statusKind(PublishItemStatus itemStatus, string expectedStatusKind)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseDto(nameof(LifecycleState.ReviewConfirmed)));
        var topic = MakeTopic("topic_1", NodeConfirmation.Confirmed);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter("chapter_1", topic)]);
        sut.Repository.GetLatestByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new PublishBatch { Id = "batch_1", CourseId = "course_1", TotalNodes = 1, Remaining = 1 });
        sut.Repository.GetItemsByBatchIdAsync("batch_1", Arg.Any<CancellationToken>())
            .Returns([new PublishBatchItem { Id = "item_1", BatchId = "batch_1", TopicId = "topic_1", Status = itemStatus }]);

        var status = await sut.Service.GetStatusAsync("course_1");

        var topicRow = status.Checklist!.Single(r => r.NodeId == "topic_1");
        Assert.Equal(expectedStatusKind, topicRow.StatusKind);
    }
}
