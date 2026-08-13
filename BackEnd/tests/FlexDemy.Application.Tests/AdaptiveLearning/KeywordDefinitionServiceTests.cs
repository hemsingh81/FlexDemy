using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class KeywordDefinitionServiceTests
{
    private const string CourseIdA = "course_a";
    private const string CourseIdB = "course_b";
    private const string Keyword = "wavelength";
    private const string NormalizedKeyword = "wavelength";

    private sealed record Sut(
        KeywordDefinitionService Service,
        IKeywordDefinitionRepository Repository,
        ICourseService CourseService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork,
        IAiTaskGateway AiTaskGateway);

    private static CourseDto MakeCourseDto(string courseId, string subject, string lifecycleState = "Published") => new(
        courseId, "Title", "", "", subject, "", "", [], "", null, null, 5.0m, 0, 1, null, null,
        lifecycleState, [], [], null, null, null, null, null, null);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IKeywordDefinitionRepository>();
        var courseService = Substitute.For<ICourseService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var aiTaskGateway = Substitute.For<IAiTaskGateway>();

        courseService.GetCourseByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(ci => MakeCourseDto(ci.Arg<string>(), "Physics"));
        courseService.GetOwningTutorIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns("tutor_1");
        courseService.EnsureOwnedAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        idGenerator.NewId().Returns("new_id");
        aiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("A wave carries energy.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));

        var service = new KeywordDefinitionService(repository, courseService, idGenerator, unitOfWork, aiTaskGateway);
        return new Sut(service, repository, courseService, idGenerator, unitOfWork, aiTaskGateway);
    }

    // -- Lifecycle gate (Story 3.9/Task 2) ------------------------------------------------------
    // Story 3.7 originally built no gate at all here (see AdaptiveLearningService.cs's/
    // ExerciseService.cs's own sibling comments) -- these are the first tests of DefineAsync
    // actually rejecting a non-viewable course.

    [Fact]
    public async Task DefineAsync_throws_NotFound_when_the_course_is_Draft()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseIdA, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(CourseIdA, "Physics", "Draft"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DefineAsync(CourseIdA, Keyword));
        await sut.AiTaskGateway.DidNotReceive().DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task DefineAsync_succeeds_for_the_owning_tutor_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseIdA, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(CourseIdA, "Physics", lifecycleState));
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        Assert.NotNull(result.Definition);
        await sut.CourseService.Received(1).EnsureOwnedAsync(CourseIdA, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task DefineAsync_throws_for_a_non_owner_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseIdA, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(CourseIdA, "Physics", lifecycleState));
        sut.CourseService.When(c => c.EnsureOwnedAsync(CourseIdA, Arg.Any<CancellationToken>()))
            .Do(_ => throw new UnauthorizedAppException("You do not have permission to modify this course."));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.DefineAsync(CourseIdA, Keyword));
        await sut.AiTaskGateway.DidNotReceive().DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineAsync_and_SetOverrideAsync_normalize_internal_whitespace_and_case_to_the_same_cache_key()
    {
        var sut = MakeSut();
        var capturedKeys = new List<string>();
        sut.Repository.GetAsync(Arg.Any<string>(), Arg.Do<string>(k => capturedKeys.Add(k)), Arg.Any<CancellationToken>())
            .Returns((KeywordDefinition?)null);

        // A double-internal-space variant (plausible from an HTML text-node join or copy-paste)
        // and a leading/trailing-padded variant of "the same" keyword must both resolve to the
        // identical normalized cache key -- otherwise a tutor's override written under one
        // whitespace/case variant would silently miss a student's lookup under another.
        // (SetOverrideAsync's own upsert makes 1 GetAsync call; DefineAsync makes 2 -- its own
        // top-level cache check, then a second inside its upsert's pre-insert existence check --
        // every one of those 3 calls must still carry the identical normalized key.)
        await sut.Service.SetOverrideAsync(CourseIdA, "Wave  Length", "Tutor definition.");
        await sut.Service.DefineAsync(CourseIdA, "  wave length  ");

        Assert.Equal(3, capturedKeys.Count);
        Assert.All(capturedKeys, key => Assert.Equal("wave length", key));
    }

    [Fact]
    public async Task DefineAsync_generates_and_persists_when_no_cached_row_exists()
    {
        var sut = MakeSut();
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        KeywordDefinition? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<KeywordDefinition>())).Do(ci => added = ci.Arg<KeywordDefinition>());

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        await sut.AiTaskGateway.Received(1).DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.NotNull(added);
        Assert.Equal("A wave carries energy.", added!.GeneratedDefinitionText);
        Assert.Equal("A wave carries energy.", result.Definition);
        Assert.False(result.IsOverridden);
    }

    [Fact]
    public async Task DefineAsync_returns_a_cached_row_without_calling_the_gateway_when_one_exists()
    {
        var sut = MakeSut();
        var existing = new KeywordDefinition { Id = "kd_1", CourseId = CourseIdA, Keyword = Keyword, NormalizedKeyword = NormalizedKeyword, GeneratedDefinitionText = "Cached definition." };
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        await sut.AiTaskGateway.DidNotReceive().DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
        Assert.Equal("Cached definition.", result.Definition);
    }

    [Fact]
    public async Task DefineAsync_serves_an_override_over_a_generated_definition()
    {
        var sut = MakeSut();
        var existing = new KeywordDefinition
        {
            Id = "kd_1", CourseId = CourseIdA, Keyword = Keyword, NormalizedKeyword = NormalizedKeyword,
            GeneratedDefinitionText = "AI definition.", OverrideDefinitionText = "Tutor definition.",
        };
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        Assert.Equal("Tutor definition.", result.Definition);
        Assert.True(result.IsOverridden);
    }

    [Fact]
    public async Task DefineAsync_the_same_keyword_in_two_different_courses_resolves_independently_never_sharing_a_cached_row()
    {
        var sut = MakeSut();
        var courseARow = new KeywordDefinition { Id = "kd_a", CourseId = CourseIdA, Keyword = Keyword, NormalizedKeyword = NormalizedKeyword, GeneratedDefinitionText = "Physics definition." };
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns(courseARow);
        sut.Repository.GetAsync(CourseIdB, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        sut.CourseService.GetCourseByIdAsync(CourseIdB, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(CourseIdB, "Chemistry"));
        sut.AiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("Chemistry definition.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));

        var resultA = await sut.Service.DefineAsync(CourseIdA, Keyword);
        var resultB = await sut.Service.DefineAsync(CourseIdB, Keyword);

        Assert.Equal("Physics definition.", resultA.Definition);
        Assert.Equal("Chemistry definition.", resultB.Definition);
        // Course B's lookup never touched course A's cached row -- independent resolution, per AC#3.
        await sut.AiTaskGateway.Received(1).DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineAsync_AiTaskUnavailableException_returns_definition_null_rather_than_propagating()
    {
        var sut = MakeSut();
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        sut.AiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(new AiTaskUnavailableException("defineKeyword")));

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        Assert.Null(result.Definition);
        Assert.False(result.IsOverridden);
    }

    [Fact]
    public async Task DefineAsync_AiTaskBudgetExceededException_returns_definition_null_rather_than_propagating()
    {
        var sut = MakeSut();
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        sut.AiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(new AiTaskBudgetExceededException("defineKeyword")));

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        Assert.Null(result.Definition);
    }

    [Fact]
    public async Task DefineAsync_any_other_exception_type_propagates_as_a_genuine_bug_signal()
    {
        var sut = MakeSut();
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        sut.AiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(new InvalidOperationException("unexpected")));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Service.DefineAsync(CourseIdA, Keyword));
    }

    [Fact]
    public async Task DefineAsync_a_malformed_AI_response_propagates_as_AiResponseValidationException()
    {
        var sut = MakeSut();
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null);
        sut.AiTaskGateway.DefineKeywordAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("   ", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));

        await Assert.ThrowsAsync<AiResponseValidationException>(() => sut.Service.DefineAsync(CourseIdA, Keyword));
    }

    [Fact]
    public async Task SetOverrideAsync_requires_tutor_ownership()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseIdA, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new UnauthorizedAppException("not yours")));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.SetOverrideAsync(CourseIdA, Keyword, "override text"));
    }

    [Fact]
    public async Task SetOverrideAsync_writes_OverrideDefinitionText_and_leaves_GeneratedDefinitionText_untouched()
    {
        var sut = MakeSut();
        var existing = new KeywordDefinition { Id = "kd_1", CourseId = CourseIdA, Keyword = Keyword, NormalizedKeyword = NormalizedKeyword, GeneratedDefinitionText = "AI text." };
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.SetOverrideAsync(CourseIdA, Keyword, "Tutor text.");

        Assert.Equal("Tutor text.", existing.OverrideDefinitionText);
        Assert.Equal("AI text.", existing.GeneratedDefinitionText);
    }

    [Fact]
    public async Task DefineAsync_returns_the_winning_rows_content_when_a_concurrent_request_wins_the_insert_race()
    {
        var sut = MakeSut();
        var winnerRow = new KeywordDefinition { Id = "winner", CourseId = CourseIdA, Keyword = Keyword, NormalizedKeyword = NormalizedKeyword, GeneratedDefinitionText = "Winner definition." };
        // Three calls to GetAsync happen in sequence: DefineAsync's own top-level cache check
        // (null -- no cache hit), UpsertGeneratedAsync's own existence check (null -- still
        // nothing, so it attempts an insert), then the post-failure re-check inside the catch
        // block (the concurrent winner's row).
        sut.Repository.GetAsync(CourseIdA, NormalizedKeyword, Arg.Any<CancellationToken>()).Returns((KeywordDefinition?)null, (KeywordDefinition?)null, winnerRow);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("simulated unique constraint violation")));

        var result = await sut.Service.DefineAsync(CourseIdA, Keyword);

        Assert.Equal("Winner definition.", result.Definition);
    }
}
