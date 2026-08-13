using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class AdaptiveLearningServiceTests
{
    private const string CourseId = "course_1";
    private const string TopicId = "topic_1";

    private const string ValidLevelJson = """
        {
          "title": "Level 1",
          "subtitle": "The simplest framing",
          "content": "A wave carries energy without carrying matter.",
          "keyPoints": ["Energy transfer"],
          "mathFormulas": [],
          "examples": [
            { "id": "ex_1", "title": "Worked example", "problem": "p", "stepByStepSolution": ["s"], "finalAnswer": "f", "difficulty": "Easy" }
          ]
        }
        """;

    private const string ValidWayJson = """
        {
          "explanation": "Picture a stadium wave.",
          "example": { "id": "way_ex_1", "title": "Worked example", "problem": "p", "stepByStepSolution": ["s"], "finalAnswer": "f", "difficulty": "Medium" }
        }
        """;

    private const string WinnerLevelJson = """
        {"title":"Winner Level","subtitle":"S","content":"C","keyPoints":["a"],"mathFormulas":[],"examples":[{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}]}
        """;

    private const string WinnerWayJson = """
        {"explanation":"Winner explanation.","example":{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}}
        """;

    private sealed record Sut(
        AdaptiveLearningService Service,
        IAdaptiveLearningRepository Repository,
        IContentTreeRepository ContentTreeRepository,
        ICourseService CourseService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork,
        IAiTaskGateway AiTaskGateway);

    private static CourseDto MakeCourseDto(string lifecycleState) => new(
        CourseId, "Title", "", "", "", "", "", [], "", null, null, 5.0m, 0, 1, null, null,
        lifecycleState, [], [], null, null, null, null, null, null);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IAdaptiveLearningRepository>();
        var contentTreeRepository = Substitute.For<IContentTreeRepository>();
        var courseService = Substitute.For<ICourseService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var aiTaskGateway = Substitute.For<IAiTaskGateway>();

        contentTreeRepository.FindNodeAsync(CourseId, TopicId, Arg.Any<CancellationToken>())
            .Returns(new TreeNode(null, new Topic { Id = TopicId, ChapterId = "chapter_1", Title = "Topic", Confirmation = NodeConfirmation.Confirmed, Order = 0 }, null, null));
        contentTreeRepository.GetContentBlocksByTopicIdAsync(TopicId, Arg.Any<CancellationToken>())
            .Returns(new List<ContentBlock> { new() { Id = "block_1", TopicId = TopicId, Format = ContentBlockFormat.Text, Confirmation = NodeConfirmation.Confirmed, Order = 0, Text = "Wave content." } });
        courseService.GetOwningTutorIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns("tutor_1");
        courseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto("Published"));
        idGenerator.NewId().Returns("new_id");
        aiTaskGateway.ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult(ValidLevelJson, "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));
        aiTaskGateway.RewriteExplanationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult(ValidWayJson, "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));

        var service = new AdaptiveLearningService(repository, contentTreeRepository, courseService, idGenerator, unitOfWork, aiTaskGateway);
        return new Sut(service, repository, contentTreeRepository, courseService, idGenerator, unitOfWork, aiTaskGateway);
    }

    // -- GenerateLevelAsync ------------------------------------------------------------------------

    [Fact]
    public async Task GenerateLevelAsync_calls_ExplainTopicAsync_and_persists_to_GeneratedContentJson_never_OverrideContentJson()
    {
        var sut = MakeSut();
        DrilldownLevel? added = null;
        sut.Repository.When(r => r.AddLevel(Arg.Any<DrilldownLevel>())).Do(ci => added = ci.Arg<DrilldownLevel>());

        var result = await sut.Service.GenerateLevelAsync(CourseId, TopicId, 1);

        await sut.AiTaskGateway.Received(1).ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.NotNull(added);
        Assert.NotNull(added!.GeneratedContentJson);
        Assert.Null(added.OverrideContentJson);
        Assert.Equal("Level 1", result.Title);
        Assert.False(result.IsOverridden);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GenerateLevelAsync_updates_an_existing_row_rather_than_duplicating_it()
    {
        var sut = MakeSut();
        var existing = new DrilldownLevel { Id = "row_1", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = "{\"stale\":true}" };
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.GenerateLevelAsync(CourseId, TopicId, 1);

        sut.Repository.DidNotReceive().AddLevel(Arg.Any<DrilldownLevel>());
        Assert.Contains("Level 1", existing.GeneratedContentJson);
    }

    // -- Concurrent-insert race (code-review patch) ---------------------------------------------------

    [Fact]
    public async Task GenerateLevelAsync_returns_the_winning_rows_content_when_a_concurrent_request_wins_the_insert_race()
    {
        var sut = MakeSut();
        var winnerRow = new DrilldownLevel { Id = "winner_row", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = WinnerLevelJson };
        // First existence check (before the insert attempt) finds nothing; the retry check after
        // the failed insert finds the concurrent winner's now-persisted row.
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null, winnerRow);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("simulated unique constraint violation from a concurrent insert")));

        var result = await sut.Service.GenerateLevelAsync(CourseId, TopicId, 1);

        // The winner's content is returned; our own (redundant) freshly-generated content is
        // discarded, not saved a second time.
        Assert.Equal("Winner Level", result.Title);
    }

    [Fact]
    public async Task GenerateLevelAsync_rethrows_when_SaveChangesAsync_fails_for_a_reason_other_than_a_lost_insert_race()
    {
        var sut = MakeSut();
        // No row exists even after the failure -- this wasn't a race, so the original failure
        // must propagate rather than being silently absorbed.
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null, (DrilldownLevel?)null);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("a genuine database failure")));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Service.GenerateLevelAsync(CourseId, TopicId, 1));
    }

    [Fact]
    public async Task SetLevelOverrideAsync_retries_as_an_update_against_the_winning_row_when_a_concurrent_request_wins_the_insert_race()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        var winnerRow = new DrilldownLevel { Id = "winner_row", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = ValidLevelJson };
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null, winnerRow);
        // First SaveChangesAsync (our own insert attempt) fails; the retried UPDATE against the
        // winner row succeeds -- unlike generation, an override write must still take effect
        // (last-write-wins) rather than being discarded.
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("simulated unique constraint violation")), Task.FromResult(1));
        var content = new DrilldownLevelContent("Tutor Title", "S", "C", ["a"], null, [new ExampleItemContent("e", "t", "p", ["s"], "f", "Easy")]);

        await sut.Service.SetLevelOverrideAsync(CourseId, TopicId, 1, content);

        Assert.Contains("Tutor Title", winnerRow.OverrideContentJson);
        await sut.UnitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GenerateWayAsync_returns_the_winning_rows_content_when_a_concurrent_request_wins_the_insert_race()
    {
        var sut = MakeSut();
        var winnerRow = new WayContent { Id = "winner_row", TopicId = TopicId, WayNumber = 1, GeneratedContentJson = WinnerWayJson };
        sut.Repository.GetWayAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((WayContent?)null, winnerRow);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("simulated unique constraint violation from a concurrent insert")));

        var result = await sut.Service.GenerateWayAsync(CourseId, TopicId, 1);

        Assert.Equal("Winner explanation.", result.Explanation);
    }

    // -- GetOrGenerateLevelAsync (AC#4: on-demand fallback) -----------------------------------------

    [Fact]
    public async Task GetOrGenerateLevelAsync_returns_a_cached_row_without_calling_the_gateway_when_one_exists()
    {
        var sut = MakeSut();
        var existing = new DrilldownLevel { Id = "row_1", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = ValidLevelJson };
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1);

        await sut.AiTaskGateway.DidNotReceive().ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.Equal("Level 1", result.Title);
    }

    [Fact]
    public async Task GetOrGenerateLevelAsync_generates_and_persists_when_no_row_exists()
    {
        var sut = MakeSut();
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null);

        var result = await sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1);

        await sut.AiTaskGateway.Received(1).ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.Equal("Level 1", result.Title);
    }

    [Fact]
    public async Task GetOrGenerateLevelAsync_throws_NotFound_when_the_course_is_Draft()
    {
        // Story 3.9/Task 2: Draft is deliberately still excluded from the widened gate --
        // Review-as-Student is only reachable once MoveToReviewAsync has already run.
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto("Draft"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1));
        await sut.AiTaskGateway.DidNotReceive().ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    // Story 3.9/Task 2: the widened gate -- a tutor previewing their own course via
    // Review-as-Student can generate/read Drill-Down content for the two later pre-publish
    // lifecycle states, but only if they're actually the owner.
    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task GetOrGenerateLevelAsync_succeeds_for_the_owning_tutor_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(lifecycleState));
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null);

        var result = await sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1);

        Assert.NotNull(result);
        await sut.CourseService.Received(1).EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task GetOrGenerateLevelAsync_throws_for_a_non_owner_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(lifecycleState));
        sut.CourseService.When(c => c.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()))
            .Do(_ => throw new UnauthorizedAppException("You do not have permission to modify this course."));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1));
        await sut.AiTaskGateway.DidNotReceive().ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_row_with_a_non_null_OverrideContentJson_is_served_over_GeneratedContentJson_by_GetOrGenerateLevelAsync()
    {
        var sut = MakeSut();
        const string overrideJson = """
            {"title":"Tutor Level 1","subtitle":"S","content":"Tutor-written content.","keyPoints":["a"],"mathFormulas":[],"examples":[{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}]}
            """;
        var existing = new DrilldownLevel { Id = "row_1", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = ValidLevelJson, OverrideContentJson = overrideJson };
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.GetOrGenerateLevelAsync(CourseId, TopicId, 1);

        Assert.Equal("Tutor Level 1", result.Title);
        Assert.True(result.IsOverridden);
        await sut.AiTaskGateway.DidNotReceive().ExplainTopicAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    // -- SetLevelOverrideAsync -----------------------------------------------------------------------

    [Fact]
    public async Task SetLevelOverrideAsync_requires_tutor_ownership()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new UnauthorizedAppException("not yours")));
        var content = new DrilldownLevelContent("T", "S", "C", ["a"], null, [new ExampleItemContent("e", "t", "p", ["s"], "f", "Easy")]);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.SetLevelOverrideAsync(CourseId, TopicId, 1, content));
    }

    [Fact]
    public async Task SetLevelOverrideAsync_never_requires_LifecycleState_Draft()
    {
        var sut = MakeSut();
        // No stubbed course lookup / LifecycleState check at all -- EnsureOwnedAsync (not
        // EnsureOwnedDraftAsync) is the only guard SetLevelOverrideAsync calls.
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        var content = new DrilldownLevelContent("T", "S", "C", ["a"], null, [new ExampleItemContent("e", "t", "p", ["s"], "f", "Easy")]);

        await sut.Service.SetLevelOverrideAsync(CourseId, TopicId, 1, content);

        await sut.CourseService.Received(1).EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>());
        await sut.CourseService.DidNotReceive().EnsureOwnedDraftAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetLevelOverrideAsync_writes_OverrideContentJson_and_leaves_GeneratedContentJson_untouched()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        var existing = new DrilldownLevel { Id = "row_1", TopicId = TopicId, LevelNumber = 1, GeneratedContentJson = ValidLevelJson };
        sut.Repository.GetLevelAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);
        var content = new DrilldownLevelContent("Tutor Title", "S", "C", ["a"], null, [new ExampleItemContent("e", "t", "p", ["s"], "f", "Easy")]);

        await sut.Service.SetLevelOverrideAsync(CourseId, TopicId, 1, content);

        Assert.Contains("Tutor Title", existing.OverrideContentJson);
        Assert.Equal(ValidLevelJson, existing.GeneratedContentJson);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // -- Ways: mirrored coverage --------------------------------------------------------------------

    [Fact]
    public async Task GenerateWayAsync_calls_RewriteExplanationAsync_and_persists_to_GeneratedContentJson_never_OverrideContentJson()
    {
        var sut = MakeSut();
        WayContent? added = null;
        sut.Repository.When(r => r.AddWay(Arg.Any<WayContent>())).Do(ci => added = ci.Arg<WayContent>());

        var result = await sut.Service.GenerateWayAsync(CourseId, TopicId, 1);

        await sut.AiTaskGateway.Received(1).RewriteExplanationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.NotNull(added);
        Assert.NotNull(added!.GeneratedContentJson);
        Assert.Null(added.OverrideContentJson);
        Assert.False(result.IsOverridden);
    }

    [Fact]
    public async Task GetOrGenerateWayAsync_returns_a_cached_row_without_calling_the_gateway_when_one_exists()
    {
        var sut = MakeSut();
        var existing = new WayContent { Id = "row_1", TopicId = TopicId, WayNumber = 1, GeneratedContentJson = ValidWayJson };
        sut.Repository.GetWayAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.GetOrGenerateWayAsync(CourseId, TopicId, 1);

        await sut.AiTaskGateway.DidNotReceive().RewriteExplanationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_way_row_with_a_non_null_OverrideContentJson_is_served_over_GeneratedContentJson()
    {
        var sut = MakeSut();
        const string overrideJson = """{"explanation":"Tutor explanation.","example":{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}}""";
        var existing = new WayContent { Id = "row_1", TopicId = TopicId, WayNumber = 1, GeneratedContentJson = ValidWayJson, OverrideContentJson = overrideJson };
        sut.Repository.GetWayAsync(TopicId, null, 1, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.GetOrGenerateWayAsync(CourseId, TopicId, 1);

        Assert.Equal("Tutor explanation.", result.Explanation);
        Assert.True(result.IsOverridden);
    }

    [Fact]
    public async Task SetWayOverrideAsync_requires_tutor_ownership_and_never_requires_LifecycleState_Draft()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        var content = new WayContentData("Explanation", new ExampleItemContent("e", "t", "p", ["s"], "f", "Easy"));

        await sut.Service.SetWayOverrideAsync(CourseId, TopicId, 1, content);

        await sut.CourseService.Received(1).EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>());
        await sut.CourseService.DidNotReceive().EnsureOwnedDraftAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
