using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Jobs;
using Hangfire;
using Hangfire.Common;
using Hangfire.Server;
using Hangfire.Storage;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Jobs;

// Mirrors ExtractStructureJobTests.cs's own structure/PerformContext helper -- the direct template
// Story 3.8's own Task 2 names explicitly.
public class PublishNodeContentJobTests
{
    private sealed record Sut(
        PublishNodeContentJob Job,
        IPublishBatchRepository Repository,
        IUnitOfWork UnitOfWork,
        IAdaptiveLearningService AdaptiveLearningService,
        IVersionService VersionService,
        ICourseService CourseService);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IPublishBatchRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var adaptiveLearningService = Substitute.For<IAdaptiveLearningService>();
        var versionService = Substitute.For<IVersionService>();
        var courseService = Substitute.For<ICourseService>();
        // A single-item batch (Remaining=1) so DecrementRemainingAsync's default return value (0)
        // matches "this was the last item" for tests that don't care about the finalize branch
        // specifically -- tests that DO care override this explicitly.
        repository.DecrementRemainingAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(1);

        var job = new PublishNodeContentJob(repository, unitOfWork, adaptiveLearningService, versionService, courseService);
        return new Sut(job, repository, unitOfWork, adaptiveLearningService, versionService, courseService);
    }

    private static PublishBatch MakeBatch(string id = "batch_1", string courseId = "course_1") =>
        new() { Id = id, CourseId = courseId, TotalNodes = 1, Remaining = 1 };

    private static PublishBatchItem MakeQueuedItem(string id = "item_1", string batchId = "batch_1", string? topicId = "topic_1") =>
        new() { Id = id, BatchId = batchId, TopicId = topicId, SubtopicId = topicId is null ? "subtopic_1" : null, Status = PublishItemStatus.Queued };

    private static PerformContext MakePerformContext(int? retryCount)
    {
        var method = typeof(IPublishNodeContentJob).GetMethod(nameof(IPublishNodeContentJob.RunAsync))!;
        var job = new Job(typeof(IPublishNodeContentJob), method, "item_1", CancellationToken.None, null!);
        var backgroundJob = new BackgroundJob("job_1", job, DateTime.UtcNow);
        var connection = Substitute.For<IStorageConnection>();
        connection.GetJobParameter("job_1", "RetryCount").Returns(retryCount?.ToString());
        var cancellationToken = Substitute.For<Hangfire.IJobCancellationToken>();
#pragma warning disable CS0618
        return new PerformContext(connection, backgroundJob, cancellationToken);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task RunAsync_success_sets_Status_Done_and_calls_all_10_generation_sub_calls()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(PublishItemStatus.Done, item.Status);
        for (var level = 1; level <= 5; level++)
            await sut.AdaptiveLearningService.Received(1).GenerateLevelAsync("course_1", "topic_1", level, Arg.Any<CancellationToken>());
        for (var wayNumber = 1; wayNumber <= 5; wayNumber++)
            await sut.AdaptiveLearningService.Received(1).GenerateWayAsync("course_1", "topic_1", wayNumber, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_updates_ProgressText_before_each_of_the_10_generation_sub_calls()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        var progressSnapshots = new List<string?>();
        sut.AdaptiveLearningService.When(s => s.GenerateLevelAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>()))
            .Do(_ => progressSnapshots.Add(item.ProgressText));
        sut.AdaptiveLearningService.When(s => s.GenerateWayAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>()))
            .Do(_ => progressSnapshots.Add(item.ProgressText));

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(10, progressSnapshots.Count);
        Assert.Equal("Generating Level 1 of 5…", progressSnapshots[0]);
        Assert.Equal("Generating Level 5 of 5…", progressSnapshots[4]);
        Assert.Equal("Generating Way 1 of 5…", progressSnapshots[5]);
        Assert.Equal("Generating Way 5 of 5…", progressSnapshots[9]);
    }

    [Fact]
    public async Task RunAsync_a_generation_failure_sets_Status_Failed_without_throwing_out_of_the_job()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.AdaptiveLearningService.GenerateLevelAsync("course_1", "topic_1", 3, Arg.Any<CancellationToken>())
            .Returns<DrilldownLevelDto>(_ => throw new AiResponseValidationException("unusable response"));

        // No exception should escape RunAsync -- the batch must not be blocked by one node's failure.
        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(PublishItemStatus.Failed, item.Status);
        // Levels 1-3 were attempted (level 3 is the one that throws); level 4/5 and all 5 Ways never ran.
        await sut.AdaptiveLearningService.Received(3).GenerateLevelAsync("course_1", "topic_1", Arg.Any<int>(), Arg.Any<CancellationToken>());
        await sut.AdaptiveLearningService.DidNotReceiveWithAnyArgs().GenerateWayAsync(default!, default!, default, default);
    }

    [Fact]
    public async Task RunAsync_AiTaskBudgetExceededException_sets_Status_Failed_immediately_with_no_retry_triggering_propagation()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.AdaptiveLearningService.GenerateLevelAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns<DrilldownLevelDto>(_ => throw new AiTaskBudgetExceededException("explainTopic"));

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(PublishItemStatus.Failed, item.Status);
        Assert.Contains("budget", item.ProgressText, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RunAsync_AiTaskUnavailableException_on_a_non_final_attempt_propagates_uncaught()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.AdaptiveLearningService.GenerateLevelAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns<DrilldownLevelDto>(_ => throw new AiTaskUnavailableException("explainTopic"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<AiTaskUnavailableException>(() => sut.Job.RunAsync("item_1", CancellationToken.None, context));

        Assert.Equal(PublishItemStatus.InProgress, item.Status);
        // A retry-worthy failure must not decrement the batch counter -- only a terminal item does.
        await sut.Repository.DidNotReceiveWithAnyArgs().DecrementRemainingAsync(default!, default!, default);
    }

    [Fact]
    public async Task RunAsync_on_the_final_attempt_sets_Status_Failed_regardless_of_the_exception_type()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.AdaptiveLearningService.GenerateLevelAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns<DrilldownLevelDto>(_ => throw new AiTaskUnavailableException("explainTopic"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("item_1", CancellationToken.None, context);

        Assert.Equal(PublishItemStatus.Failed, item.Status);
        Assert.Equal("AI generation unavailable — retries exhausted", item.ProgressText);
    }

    // Code-review-lesson-applied-proactively / story-text-correction: Task 2's own literal text
    // says "guard on Status == Queued", but that's incompatible with the same task's own stated
    // "[AutomaticRetry]... everything-else-retries" design -- once Status flips to InProgress (a
    // few lines later in the same task), a strict Queued-only guard would make every Hangfire
    // retry attempt silently no-op forever, permanently stuck InProgress, never reaching a
    // terminal state, and therefore never unblocking the batch (a direct AC#2 violation). The
    // guard actually implemented (and tested here) only skips already-terminal (Done/Failed)
    // items, so a genuine Hangfire retry can still resume and complete the item.
    //
    // Code-review patch: an already-terminal item no longer skips the WHOLE method -- only
    // generation is skipped; the decrement/finalize step below still always runs (see that
    // regression test group further down for why: the original "return immediately" guard was
    // itself a bug once it covered the decrement too).
    [Fact]
    public async Task RunAsync_does_not_repeat_generation_for_an_already_Done_item()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.Status = PublishItemStatus.Done;
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.AdaptiveLearningService.DidNotReceiveWithAnyArgs().GenerateLevelAsync(default!, default!, default, default);
        // No interim-progress SaveChangesAsync from the (skipped) generation loop -- the only
        // SaveChangesAsync calls in this job belong to that loop; the decrement below is raw SQL,
        // not routed through IUnitOfWork.
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_does_not_repeat_generation_for_an_already_Failed_item()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.Status = PublishItemStatus.Failed;
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.AdaptiveLearningService.DidNotReceiveWithAnyArgs().GenerateLevelAsync(default!, default!, default, default);
    }

    [Fact]
    public async Task RunAsync_resumes_an_InProgress_item_rather_than_skipping_it_so_a_Hangfire_retry_can_actually_complete()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.Status = PublishItemStatus.InProgress; // simulates a resumed retry after a transient mid-run failure
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(PublishItemStatus.Done, item.Status);
        await sut.AdaptiveLearningService.Received(5).GenerateLevelAsync("course_1", "topic_1", Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_the_item_whose_decrement_reaches_zero_creates_the_version_snapshot_and_marks_the_course_Published()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.Repository.DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>()).Returns(0);

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.VersionService.Received(1).CreateSnapshotAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_an_item_whose_decrement_does_not_reach_zero_never_finalizes()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.Repository.DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>()).Returns(3);

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.VersionService.DidNotReceiveWithAnyArgs().CreateSnapshotAsync(default!, default);
        await sut.CourseService.DidNotReceive().MarkPublishedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_failed_item_still_decrements_and_can_still_trigger_finalize()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.Repository.DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>()).Returns(0);
        sut.AdaptiveLearningService.GenerateLevelAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns<DrilldownLevelDto>(_ => throw new AiTaskBudgetExceededException("explainTopic"));

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        Assert.Equal(PublishItemStatus.Failed, item.Status);
        await sut.Repository.Received(1).DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
    }

    // -- Code-review regression tests: the decrement/finalize step must survive a Hangfire retry
    // that occurs AFTER the item's own Status is already terminal (the original bug: an early
    // `return` on Done/Failed meant a retried decrement/finalize call after this exact block
    // itself threw could never be re-attempted -- see PublishNodeContentJob.cs's own comment on
    // the decrement line and IPublishBatchRepository.DecrementRemainingAsync's doc comment). ------

    [Fact]
    public async Task RunAsync_always_attempts_the_decrement_for_an_already_terminal_item_even_though_generation_is_skipped()
    {
        // Simulates a Hangfire retry of an item whose Status reached Done on a PRIOR attempt, but
        // whose decrement/finalize call itself threw that time (e.g. a transient DB blip) -- the
        // retry must still reach DecrementRemainingAsync, not return early before it.
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.Status = PublishItemStatus.Done;
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.Repository.Received(1).DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_finalizes_on_a_retry_of_an_already_Done_item_if_the_decrement_now_reports_zero()
    {
        // The repository's own DecrementRemainingAsync is documented as idempotent -- a repeated
        // call for an item that already claimed its decrement still returns the CURRENT Remaining
        // value (not a stale/default one), so a retry that reaches this point after a previous
        // finalize failure can still discover Remaining == 0 and finalize.
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.Status = PublishItemStatus.Done;
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());
        sut.Repository.DecrementRemainingAsync("item_1", "batch_1", Arg.Any<CancellationToken>()).Returns(0);

        await sut.Job.RunAsync("item_1", CancellationToken.None);

        await sut.VersionService.Received(1).CreateSnapshotAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).MarkPublishedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_throws_InvalidOperationException_for_an_item_with_neither_TopicId_nor_SubtopicId_set()
    {
        var sut = MakeSut();
        var item = MakeQueuedItem();
        item.TopicId = null;
        item.SubtopicId = null;
        sut.Repository.GetItemByIdAsync("item_1", Arg.Any<CancellationToken>()).Returns(item);
        sut.Repository.GetByIdAsync("batch_1", Arg.Any<CancellationToken>()).Returns(MakeBatch());

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Job.RunAsync("item_1", CancellationToken.None));
    }
}
