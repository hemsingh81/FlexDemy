using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;
using FlexDemy.Infrastructure.Jobs;
using Hangfire;
using Hangfire.Common;
using Hangfire.Server;
using Hangfire.Storage;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Jobs;

// Story 2.8's own Task 7 lists this file under FlexDemy.Application.Tests/Jobs/ -- ExtractStructureJob
// itself lives under Infrastructure/Jobs (Task 4), so per this codebase's established convention
// ("put a test where its subject's path would put it") and the identical corrections already
// documented for ScanFileJobTests.cs/ParseFileJobTests.cs (Stories 2.6/2.7), this test lives in
// FlexDemy.Infrastructure.Tests/Jobs/ instead.
public class ExtractStructureJobTests
{
    private sealed record Sut(ExtractStructureJob Job, ICourseFileRepository Repository, IUnitOfWork UnitOfWork, ICourseService CourseService, IAiTaskGateway AiTaskGateway);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<ICourseFileRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var courseService = Substitute.For<ICourseService>();
        courseService.GetOwningTutorIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns("tutor_1");
        var aiTaskGateway = Substitute.For<IAiTaskGateway>();
        var job = new ExtractStructureJob(repository, unitOfWork, courseService, aiTaskGateway);
        return new Sut(job, repository, unitOfWork, courseService, aiTaskGateway);
    }

    private static CourseFile MakeExtractingFile(string id = "file_1") => new()
    {
        Id = id,
        CourseId = "draft_1",
        FileName = "notes.pdf",
        ContentType = "application/pdf",
        StoredUrl = "/private-uploads/course-files/notes.pdf",
        Status = JobItemStatus.Extracting,
        ParsedContent = "# Chapter 1\nSome content.",
    };

    private const string ValidJson = """{"chapters":[{"title":"Chapter 1","topics":[{"title":"Topic 1","contentBlocks":[{"format":"text","text":"Some text","lang":"en"}],"subtopics":[]}]}]}""";

    private static AiTaskResult MakeAiResult(string content) =>
        new(content, "Groq", "llama-4-scout", new AiGatewayUsage(100, 200, 300), IsFallbackServed: false);

    private static PerformContext MakePerformContext(int? retryCount)
    {
        var method = typeof(IExtractStructureJob).GetMethod(nameof(IExtractStructureJob.RunAsync))!;
        var job = new Job(typeof(IExtractStructureJob), method, "file_1", CancellationToken.None, null!);
        var backgroundJob = new BackgroundJob("job_1", job, DateTime.UtcNow);
        var connection = Substitute.For<IStorageConnection>();
        connection.GetJobParameter("job_1", "RetryCount").Returns(retryCount?.ToString());
        var cancellationToken = Substitute.For<Hangfire.IJobCancellationToken>();
#pragma warning disable CS0618
        return new PerformContext(connection, backgroundJob, cancellationToken);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task RunAsync_a_successful_AI_call_and_successful_parse_sets_Status_Done_and_ExtractedStructureJson()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>()).Returns(MakeAiResult(ValidJson));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Done, file.Status);
        Assert.NotNull(file.ExtractedStructureJson);
        Assert.Contains("Chapter 1", file.ExtractedStructureJson);
        Assert.Null(file.FailureReason);
    }

    [Fact]
    public async Task RunAsync_passes_the_course_and_tutor_id_to_the_AI_task_gateway()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>()).Returns(MakeAiResult(ValidJson));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        await sut.AiTaskGateway.Received(1).ExtractStructureAsync(
            Arg.Is<AiTaskRequest>(r => r.CourseId == "draft_1" && r.TutorId == "tutor_1"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_successful_AI_call_whose_content_fails_parsing_sets_Status_Failed_not_Done()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>()).Returns(MakeAiResult("not json"));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Null(file.ExtractedStructureJson);
        Assert.NotNull(file.FailureReason);
    }

    [Fact]
    public async Task RunAsync_AiTaskBudgetExceededException_sets_Status_Failed_immediately_with_no_retry_triggering_propagation()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns<AiTaskResult>(_ => throw new AiTaskBudgetExceededException("extractStructure"));

        // No exception should escape RunAsync -- asserts the job does not rethrow it.
        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Contains("budget", file.FailureReason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RunAsync_AiTaskUnavailableException_on_a_non_final_attempt_propagates_uncaught()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns<AiTaskResult>(_ => throw new AiTaskUnavailableException("extractStructure"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<AiTaskUnavailableException>(() => sut.Job.RunAsync("file_1", CancellationToken.None, context));

        Assert.Equal(JobItemStatus.Extracting, file.Status);
    }

    [Fact]
    public async Task RunAsync_a_config_lookup_NotFoundException_on_a_non_final_attempt_also_propagates_uncaught()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns<AiTaskResult>(_ => throw new NotFoundException("AiTaskConfig", "extractStructure"));
        var context = MakePerformContext(retryCount: 0); // attempt 1 of 5 -- not the last

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Job.RunAsync("file_1", CancellationToken.None, context));

        Assert.Equal(JobItemStatus.Extracting, file.Status);
    }

    [Fact]
    public async Task RunAsync_on_the_final_attempt_sets_Status_Failed_regardless_of_the_exception_type()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns<AiTaskResult>(_ => throw new AiTaskUnavailableException("extractStructure"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("file_1", CancellationToken.None, context);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        // Code-review patch: matches ScanFileJob/ParseFileJob's identical final-attempt message
        // format -- not just "any non-null reason".
        Assert.Equal("AI extraction unavailable — retries exhausted", file.FailureReason);
    }

    // Code-review patch: mirrors ScanFileJobTests.cs/ParseFileJobTests.cs's identical truncation
    // tests -- ExtractStructureJob reuses the same Truncate()/MaxFailureReasonLength mechanism.
    [Fact]
    public async Task RunAsync_truncates_an_over_length_FailureReason_to_the_column_limit()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        var overLongError = new string('x', 2000);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(MakeAiResult(overLongError)); // not valid JSON -> parseError echoes the raw content

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.NotNull(file.FailureReason);
        Assert.True(file.FailureReason!.Length <= 1024);
    }

    [Fact]
    public async Task RunAsync_sets_a_generous_MaxTokens_on_the_AI_request_so_a_large_structure_is_not_truncated()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.AiTaskGateway.ExtractStructureAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>()).Returns(MakeAiResult(ValidJson));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        await sut.AiTaskGateway.Received(1).ExtractStructureAsync(
            Arg.Is<AiTaskRequest>(r => r.MaxTokens != null && r.MaxTokens > 0), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_is_a_no_op_for_a_row_that_is_not_Extracting()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        file.Status = JobItemStatus.Done;
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        await sut.AiTaskGateway.DidNotReceiveWithAnyArgs().ExtractStructureAsync(default!, default);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_null_ParsedContent_sets_Status_Failed_defensively_without_calling_the_AI()
    {
        var sut = MakeSut();
        var file = MakeExtractingFile();
        file.ParsedContent = null;
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        await sut.AiTaskGateway.DidNotReceiveWithAnyArgs().ExtractStructureAsync(default!, default);
    }
}
