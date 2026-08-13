using System.Reflection;
using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class ExerciseServiceTests
{
    private const string CourseId = "course_1";
    private const string TopicId = "topic_1";

    private const string ValidProposalJson = """
        {"questionText":"Find wavelength.","correctAnswer":"3","feedbackText":"v = f * lambda, so lambda = v/f = 3."}
        """;

    private sealed record Sut(
        ExerciseService Service,
        IExerciseRepository Repository,
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
        var repository = Substitute.For<IExerciseRepository>();
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
        courseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
        courseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto("Published"));
        idGenerator.NewId().Returns("new_id");
        aiTaskGateway.GenerateExerciseAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult(ValidProposalJson, "openai", "gpt-4o-mini", new AiGatewayUsage(10, 10, 20), IsFallbackServed: false));

        var service = new ExerciseService(repository, contentTreeRepository, courseService, idGenerator, unitOfWork, aiTaskGateway);
        return new Sut(service, repository, contentTreeRepository, courseService, idGenerator, unitOfWork, aiTaskGateway);
    }

    // -- ProposeExerciseAsync ------------------------------------------------------------------------

    [Fact]
    public async Task ProposeExerciseAsync_never_persists_anything()
    {
        var sut = MakeSut();

        var result = await sut.Service.ProposeExerciseAsync(CourseId, TopicId, AnswerType.Numeric);

        sut.Repository.DidNotReceiveWithAnyArgs().Add(default!);
        await sut.UnitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(Arg.Any<CancellationToken>());
        Assert.Equal("3", result.CorrectAnswer);
        Assert.Equal("Find wavelength.", result.QuestionText);
    }

    [Fact]
    public async Task ProposeExerciseAsync_requires_tutor_ownership()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new UnauthorizedAppException("not yours")));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.ProposeExerciseAsync(CourseId, TopicId, AnswerType.Numeric));
    }

    // -- SaveExerciseAsync ---------------------------------------------------------------------------

    [Fact]
    public async Task SaveExerciseAsync_creates_a_new_row_when_none_exists()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);
        Exercise? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<Exercise>())).Do(ci => added = ci.Arg<Exercise>());
        var request = new SaveExerciseRequest("Numeric", "Q?", null, "3", "Feedback", IsAiProposed: false);

        var result = await sut.Service.SaveExerciseAsync(CourseId, TopicId, request);

        Assert.NotNull(added);
        Assert.Equal("Q?", added!.QuestionText);
        Assert.Equal("Numeric", result.AnswerType);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveExerciseAsync_upserts_the_nodes_one_row_replacing_any_prior_exercise()
    {
        var sut = MakeSut();
        var existing = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.ShortText, QuestionText = "Old?", CorrectAnswer = "old", FeedbackText = "old fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(existing);
        var request = new SaveExerciseRequest("MultipleChoice", "New?", ["A", "B", "C"], "B", "New fb", IsAiProposed: true);

        await sut.Service.SaveExerciseAsync(CourseId, TopicId, request);

        sut.Repository.DidNotReceiveWithAnyArgs().Add(default!);
        Assert.Equal("New?", existing.QuestionText);
        Assert.Equal("B", existing.CorrectAnswer);
        Assert.Equal(AnswerType.MultipleChoice, existing.AnswerType);
        Assert.True(existing.IsAiProposed);
    }

    [Fact]
    public async Task SaveExerciseAsync_rejects_a_multipleChoice_exercise_whose_correctAnswer_is_not_among_its_options()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);
        var request = new SaveExerciseRequest("MultipleChoice", "Which?", ["A", "B", "C"], "D", "Feedback", IsAiProposed: false);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.SaveExerciseAsync(CourseId, TopicId, request));

        sut.Repository.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task SaveExerciseAsync_rejects_a_numeric_exercise_whose_correctAnswer_is_not_a_plain_number()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);
        var request = new SaveExerciseRequest("Numeric", "How far?", null, "about 5", "Feedback", IsAiProposed: false);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.SaveExerciseAsync(CourseId, TopicId, request));

        sut.Repository.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task SaveExerciseAsync_retries_as_an_update_against_the_winning_row_when_a_concurrent_request_wins_the_insert_race()
    {
        var sut = MakeSut();
        var winnerRow = new Exercise { Id = "winner_row", TopicId = TopicId, AnswerType = AnswerType.ShortText, QuestionText = "Old?", CorrectAnswer = "old", FeedbackText = "old fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null, winnerRow);
        // First SaveChangesAsync (our own insert attempt) fails; the retried UPDATE against the
        // winner row succeeds -- a tutor's own explicit save must still take effect
        // (last-write-wins) rather than being discarded or surfacing a raw 500.
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("simulated unique constraint violation")), Task.FromResult(1));
        var request = new SaveExerciseRequest("ShortText", "New?", null, "new answer", "New fb", IsAiProposed: false);

        var result = await sut.Service.SaveExerciseAsync(CourseId, TopicId, request);

        Assert.Equal("New?", winnerRow.QuestionText);
        Assert.Equal("new answer", winnerRow.CorrectAnswer);
        Assert.Equal("New?", result.QuestionText);
        await sut.UnitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveExerciseAsync_rethrows_when_SaveChangesAsync_fails_for_a_reason_other_than_a_lost_insert_race()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null, (Exercise?)null);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<int>(new InvalidOperationException("a genuine database failure")));
        var request = new SaveExerciseRequest("ShortText", "New?", null, "new answer", "New fb", IsAiProposed: false);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Service.SaveExerciseAsync(CourseId, TopicId, request));
    }

    [Fact]
    public async Task SaveExerciseAsync_requires_tutor_ownership()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new UnauthorizedAppException("not yours")));
        var request = new SaveExerciseRequest("Numeric", "Q?", null, "3", "Feedback", IsAiProposed: false);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.SaveExerciseAsync(CourseId, TopicId, request));
    }

    // -- GetExerciseAsync -----------------------------------------------------------------------------

    [Fact]
    public async Task GetExerciseAsync_returns_null_when_the_node_has_no_exercise_not_an_exception()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);

        var result = await sut.Service.GetExerciseAsync(CourseId, TopicId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetExerciseAsync_dto_never_carries_CorrectAnswer_in_any_of_its_properties()
    {
        var sut = MakeSut();
        var existing = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.ShortText, QuestionText = "Q?", CorrectAnswer = "SUPER_SECRET_ANSWER", FeedbackText = "fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(existing);

        var result = await sut.Service.GetExerciseAsync(CourseId, TopicId);

        Assert.NotNull(result);
        // Direct, reflection-based sweep of every property value on the returned DTO -- a
        // data-leak risk worth a directly-targeted assertion, not just "the test didn't happen to
        // check it".
        foreach (var property in typeof(ExerciseDto).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var value = property.GetValue(result)?.ToString() ?? "";
            Assert.DoesNotContain("SUPER_SECRET_ANSWER", value);
        }
    }

    [Fact]
    public async Task GetExerciseAsync_throws_NotFound_when_the_course_is_Draft()
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto("Draft"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetExerciseAsync(CourseId, TopicId));
    }

    // Story 3.9/Task 2: widened gate, mirroring AdaptiveLearningServiceTests.cs's own identical tests.
    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task GetExerciseAsync_succeeds_for_the_owning_tutor_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(lifecycleState));
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);

        await sut.Service.GetExerciseAsync(CourseId, TopicId);

        await sut.CourseService.Received(1).EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("InReview")]
    [InlineData("ReviewConfirmed")]
    public async Task GetExerciseAsync_throws_for_a_non_owner_when_the_course_is_InReview_or_ReviewConfirmed(string lifecycleState)
    {
        var sut = MakeSut();
        sut.CourseService.GetCourseByIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(MakeCourseDto(lifecycleState));
        sut.CourseService.When(c => c.EnsureOwnedAsync(CourseId, Arg.Any<CancellationToken>()))
            .Do(_ => throw new UnauthorizedAppException("You do not have permission to modify this course."));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.GetExerciseAsync(CourseId, TopicId));
    }

    // -- SubmitAnswerAsync (parity with Story 3.3's mock evaluator) -----------------------------------

    [Fact]
    public async Task SubmitAnswerAsync_grades_shortText_case_insensitively_and_trimmed()
    {
        var sut = MakeSut();
        var exercise = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.ShortText, QuestionText = "Q?", CorrectAnswer = "Energy", FeedbackText = "fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(exercise);

        var result = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "  ENERGY  ");

        Assert.True(result.IsCorrect);
        Assert.Equal("fb", result.FeedbackText);
    }

    [Fact]
    public async Task SubmitAnswerAsync_grades_multipleChoice_with_exact_match()
    {
        var sut = MakeSut();
        var exercise = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.MultipleChoice, QuestionText = "Q?", CorrectAnswer = "B", FeedbackText = "fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(exercise);

        var correct = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "B");
        var incorrect = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "A");

        Assert.True(correct.IsCorrect);
        Assert.False(incorrect.IsCorrect);
    }

    [Fact]
    public async Task SubmitAnswerAsync_grades_numeric_with_tolerance_for_formatting()
    {
        var sut = MakeSut();
        var exercise = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.Numeric, QuestionText = "Q?", CorrectAnswer = "3", FeedbackText = "fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(exercise);

        var result = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "3.0");

        Assert.True(result.IsCorrect);
    }

    [Fact]
    public async Task SubmitAnswerAsync_rejects_numeric_submissions_with_trailing_non_numeric_text()
    {
        var sut = MakeSut();
        var exercise = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.Numeric, QuestionText = "Q?", CorrectAnswer = "3", FeedbackText = "fb" };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(exercise);

        var result = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "3 meters");

        Assert.False(result.IsCorrect);
    }

    [Fact]
    public async Task SubmitAnswerAsync_always_returns_feedbackText_even_when_incorrect()
    {
        var sut = MakeSut();
        var exercise = new Exercise { Id = "ex_1", TopicId = TopicId, AnswerType = AnswerType.Numeric, QuestionText = "Q?", CorrectAnswer = "3", FeedbackText = "The worked solution." };
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns(exercise);

        var result = await sut.Service.SubmitAnswerAsync(CourseId, TopicId, "999");

        Assert.False(result.IsCorrect);
        Assert.Equal("The worked solution.", result.FeedbackText);
    }

    [Fact]
    public async Task SubmitAnswerAsync_throws_NotFound_when_the_node_has_no_exercise()
    {
        var sut = MakeSut();
        sut.Repository.GetByNodeAsync(TopicId, null, Arg.Any<CancellationToken>()).Returns((Exercise?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.SubmitAnswerAsync(CourseId, TopicId, "3"));
    }
}
