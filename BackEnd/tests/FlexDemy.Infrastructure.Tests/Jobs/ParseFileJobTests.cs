using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
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

// Story 2.7's own Task 7 lists this file under FlexDemy.Application.Tests/Jobs/ -- ParseFileJob
// itself lives under Infrastructure/Jobs (Task 3), so per this codebase's own convention ("put a
// test where its subject's path would put it") and Story 2.6's identical, already-documented
// correction for ScanFileJobTests.cs, this test lives in FlexDemy.Infrastructure.Tests/Jobs/ instead.
public class ParseFileJobTests
{
    private sealed record Sut(ParseFileJob Job, ICourseFileRepository Repository, IUnitOfWork UnitOfWork, IFileStorageService FileStorage, IDocumentParser DocumentParser, ICorrelationIdAccessor CorrelationIdAccessor, IErrorCaptureService ErrorCaptureService);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<ICourseFileRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var documentParser = Substitute.For<IDocumentParser>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var job = new ParseFileJob(repository, unitOfWork, fileStorage, documentParser, correlationIdAccessor, errorCaptureService);
        return new Sut(job, repository, unitOfWork, fileStorage, documentParser, correlationIdAccessor, errorCaptureService);
    }

    private static CourseFile MakeQueuedFile(string id = "file_1") => new()
    {
        Id = id,
        CourseId = "draft_1",
        FileName = "notes.pdf",
        ContentType = "application/pdf",
        StoredUrl = "/private-uploads/course-files/notes.pdf",
        Status = JobItemStatus.Queued,
    };

    // Mirrors ScanFileJobTests.cs's own MakePerformContext exactly -- same reasoning (GetJobParameter
    // isn't virtual, so a real PerformContext with a stubbed IStorageConnection is the simplest
    // mechanism that exercises the real RetryCount-reading code path).
    private static PerformContext MakePerformContext(int? retryCount)
    {
        var method = typeof(IParseFileJob).GetMethod(nameof(IParseFileJob.RunAsync))!;
        var job = new Job(typeof(IParseFileJob), method, "file_1", null!, CancellationToken.None, null!);
        var backgroundJob = new BackgroundJob("job_1", job, DateTime.UtcNow);
        var connection = Substitute.For<IStorageConnection>();
        connection.GetJobParameter("job_1", "RetryCount").Returns(retryCount?.ToString());
        var cancellationToken = Substitute.For<Hangfire.IJobCancellationToken>();
#pragma warning disable CS0618
        return new PerformContext(connection, backgroundJob, cancellationToken);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task RunAsync_transitions_Queued_to_Parsing_before_calling_the_parser()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                // At the moment the parser is called, the interim Parsing transition must
                // already be visible (AC#3: a tutor polling mid-parse sees it).
                Assert.Equal(JobItemStatus.Parsing, file.Status);
                return new DocumentParseResult(true, "# Notes", null);
            });

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        await sut.UnitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_successful_parse_sets_Status_Done_and_ParsedContent()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(true, "# Parsed Notes", null));

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Done, file.Status);
        Assert.Equal("# Parsed Notes", file.ParsedContent);
        Assert.Null(file.FailureReason);
    }

    // Story 4.1/AC#4-5: mirrors ScanFileJobTests.cs's identical propagation test.
    [Fact]
    public async Task RunAsync_sets_the_correlation_accessor()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(true, "# Notes", null));

        await sut.Job.RunAsync("file_1", "corr-abc", CancellationToken.None);

        sut.CorrelationIdAccessor.Received(1).Set("corr-abc");
    }

    [Fact]
    public async Task RunAsync_a_completed_but_failed_or_low_confidence_result_sets_Status_Failed_without_ParsedContent()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(false, null, "Parsed output confidence is too low (worst-page grade: POOR)."));

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Null(file.ParsedContent);
        Assert.Equal("Parsed output confidence is too low (worst-page grade: POOR).", file.FailureReason);
    }

    [Fact]
    public async Task RunAsync_DocumentParsingUnavailableException_on_a_non_final_attempt_propagates_uncaught_leaving_Status_Parsing()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns<DocumentParseResult>(_ => throw new DocumentParsingUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.Job.RunAsync("file_1", null, CancellationToken.None, context));

        Assert.Equal(JobItemStatus.Parsing, file.Status);
    }

    [Fact]
    public async Task RunAsync_DocumentParsingUnavailableException_on_the_final_attempt_marks_Failed()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns<DocumentParseResult>(_ => throw new DocumentParsingUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("file_1", null, CancellationToken.None, context);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Equal("Parsing service unavailable — retries exhausted", file.FailureReason);
        await sut.ErrorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.ExceptionType == "DocumentParsingUnavailableException"
                && r.RelatedEntityType == nameof(CourseFile) && r.RelatedEntityId == "file_1" && r.IsBackgroundJobFailure),
            Arg.Any<CancellationToken>());
    }

    // -- Story 4.3/AC #4: CaptureAsync is never called on a retry that still has attempts left, or
    // on a successful parse. -------------------------------------------------------------------

    [Fact]
    public async Task RunAsync_a_non_final_retry_never_calls_CaptureAsync()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns<DocumentParseResult>(_ => throw new DocumentParsingUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.Job.RunAsync("file_1", null, CancellationToken.None, context));

        await sut.ErrorCaptureService.DidNotReceiveWithAnyArgs().CaptureAsync(default!, default);
    }

    [Fact]
    public async Task RunAsync_a_successful_parse_never_calls_CaptureAsync()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(true, "# Notes", null));

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        await sut.ErrorCaptureService.DidNotReceiveWithAnyArgs().CaptureAsync(default!, default);
    }

    // Idempotency guard: unlike ScanFileJob, Parsing itself is a legitimate in-progress marker
    // (interim state committed at the start of every attempt) -- only a truly terminal row skips.
    [Theory]
    [InlineData(JobItemStatus.Failed)]
    [InlineData(JobItemStatus.Done)]
    public async Task RunAsync_is_a_no_op_for_a_row_already_in_a_terminal_state(JobItemStatus status)
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        file.Status = status;
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        await sut.FileStorage.DidNotReceiveWithAnyArgs().OpenReadAsync(default!);
        await sut.DocumentParser.DidNotReceiveWithAnyArgs().ParseAsync(default!, default!, default!);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // A retried execution (already Parsing from a prior attempt) must still proceed -- Parsing is
    // not a skip state, unlike the three terminal ones above.
    [Fact]
    public async Task RunAsync_a_row_already_Parsing_from_a_prior_attempt_still_retries_without_a_redundant_interim_save()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        file.Status = JobItemStatus.Parsing;
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(true, "# Notes", null));

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Done, file.Status);
        // Only the final-state save -- no redundant Queued->Parsing save on a retry.
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: mirrors ScanFileJobTests.cs's identical truncation test -- ParseFileJob
    // reuses the same Truncate()/MaxFailureReasonLength mechanism and needs the same coverage.
    [Fact]
    public async Task RunAsync_truncates_an_over_length_FailureReason_to_the_column_limit()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        var overLongReason = new string('x', 2000);
        sut.DocumentParser.ParseAsync(Arg.Any<Stream>(), file.FileName, file.ContentType, Arg.Any<CancellationToken>())
            .Returns(new DocumentParseResult(false, null, overLongReason));

        await sut.Job.RunAsync("file_1", null, CancellationToken.None);

        Assert.NotNull(file.FailureReason);
        Assert.True(file.FailureReason!.Length <= 1024);
    }
}
