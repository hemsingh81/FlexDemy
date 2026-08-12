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

// Story 2.6's own Task 9 lists this file under FlexDemy.Application.Tests/Jobs/ -- ScanFileJob
// itself lives under Infrastructure/Jobs (Task 5), so per this codebase's own convention ("put a
// test where its subject's path would put it, don't colocate" -- BackEnd/CLAUDE.md), this test
// lives in FlexDemy.Infrastructure.Tests/Jobs/ instead. Noted here rather than silently deviating.
public class ScanFileJobTests
{
    private sealed record Sut(ScanFileJob Job, ICourseFileRepository Repository, IUnitOfWork UnitOfWork, IFileStorageService FileStorage, IFileScanner FileScanner, IParseFileJobEnqueuer ParseEnqueuer);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<ICourseFileRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var fileScanner = Substitute.For<IFileScanner>();
        var parseEnqueuer = Substitute.For<IParseFileJobEnqueuer>();
        var job = new ScanFileJob(repository, unitOfWork, fileStorage, fileScanner, parseEnqueuer);
        return new Sut(job, repository, unitOfWork, fileStorage, fileScanner, parseEnqueuer);
    }

    private static CourseFile MakeQueuedFile(string id = "file_1") => new()
    {
        Id = id,
        CourseId = "draft_1",
        FileName = "notes.pdf",
        ContentType = "application/pdf",
        StoredUrl = "/uploads/course-files/notes.pdf",
        Status = JobItemStatus.Queued,
    };

    // A real PerformContext, built with a mocked IStorageConnection -- PerformContext.
    // GetJobParameter isn't virtual, so it can't be NSubstitute-proxied directly; constructing a
    // real one with a stubbed connection is the simplest mechanism that actually exercises
    // ScanFileJob's real RetryCount-reading code path (Dev Notes' own instruction to pick the
    // simplest mechanism Hangfire 1.8.24 supports).
    private static PerformContext MakePerformContext(int? retryCount)
    {
        var method = typeof(IScanFileJob).GetMethod(nameof(IScanFileJob.RunAsync))!;
        var job = new Job(typeof(IScanFileJob), method, "file_1", CancellationToken.None, null!);
        var backgroundJob = new BackgroundJob("job_1", job, DateTime.UtcNow);
        var connection = Substitute.For<IStorageConnection>();
        connection.GetJobParameter("job_1", "RetryCount").Returns(retryCount?.ToString());
        var cancellationToken = Substitute.For<Hangfire.IJobCancellationToken>();
#pragma warning disable CS0618 // the 4-arg overload needs a globally-initialized JobStorage.Current, which a plain unit test deliberately never sets up.
        return new PerformContext(connection, backgroundJob, cancellationToken);
#pragma warning restore CS0618
    }

    // Story 2.7: a clean scan no longer stops at "no further action" -- it chains straight into
    // parsing (updated per this story's own Task 7 instruction, not left asserting stale behavior).
    [Fact]
    public async Task RunAsync_a_clean_scan_leaves_Status_Queued_unchanged_and_enqueues_the_parse_job()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Queued, file.Status);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().DeleteAsync(default!);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        sut.ParseEnqueuer.Received(1).Enqueue("file_1");
    }

    // Story 2.7 code-review patch: a clean scan whose only failure is *scheduling* the next step
    // must not be mislabeled as a scan failure -- the scan itself succeeded.
    [Fact]
    public async Task RunAsync_a_clean_scan_whose_parse_enqueue_throws_marks_Failed_with_an_accurate_reason_not_Scan_failed()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));
        sut.ParseEnqueuer.When(e => e.Enqueue(Arg.Any<string>())).Do(_ => throw new InvalidOperationException("Hangfire storage unavailable"));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Contains("schedule parsing", file.FailureReason);
        Assert.DoesNotContain("Scan failed", file.FailureReason);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_malware_positive_scan_sets_Status_Failed_with_the_threat_name_and_deletes_the_stored_file()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(false, "Eicar-Test-Signature"));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Contains("Eicar-Test-Signature", file.FailureReason);
        await sut.FileStorage.Received(1).DeleteAsync(file.StoredUrl, Arg.Any<CancellationToken>());
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        sut.ParseEnqueuer.DidNotReceiveWithAnyArgs().Enqueue(default!);
    }

    // Code-review patch: the DB write must commit before the file is deleted from disk -- if
    // SaveChangesAsync ran after DeleteAsync and threw, the row would be stuck Queued while the
    // file is already gone.
    [Fact]
    public async Task RunAsync_a_malware_positive_scan_saves_the_Failed_status_before_deleting_the_stored_file()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(false, "Eicar-Test-Signature"));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Received.InOrder(() =>
        {
            sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>());
            sut.FileStorage.DeleteAsync(file.StoredUrl, Arg.Any<CancellationToken>());
        });
    }

    // Code-review patch (idempotency guard): a retried/replayed execution of an already-terminal
    // row must not re-scan or re-delete an already-handled file.
    [Theory]
    [InlineData(JobItemStatus.Failed)]
    [InlineData(JobItemStatus.Done)]
    public async Task RunAsync_is_a_no_op_for_a_row_that_is_no_longer_Queued(JobItemStatus status)
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        file.Status = status;
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        await sut.FileStorage.DidNotReceiveWithAnyArgs().OpenReadAsync(default!);
        await sut.FileScanner.DidNotReceiveWithAnyArgs().ScanAsync(default!);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: the catch used to only cover FileScanUnavailableException -- any other
    // exception (e.g. a raw FileNotFoundException from OpenReadAsync) now follows the same
    // retry-then-fail-closed path instead of burning retries with no compensating write.
    [Fact]
    public async Task RunAsync_a_non_FileScanUnavailableException_on_the_final_attempt_also_marks_Failed()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>())
            .Returns<Task<Stream>>(_ => throw new FileNotFoundException("stored file missing"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("file_1", CancellationToken.None, context);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Contains("Scan failed", file.FailureReason);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: ClamAV's own reported threat name is out of this codebase's control --
    // it must not be able to overflow the failure_reason column and throw an unhandled
    // DbUpdateException at SaveChangesAsync.
    [Fact]
    public async Task RunAsync_truncates_an_over_length_FailureReason_to_the_column_limit()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        var overLongThreatName = new string('x', 2000);
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(false, overLongThreatName));

        await sut.Job.RunAsync("file_1", CancellationToken.None);

        Assert.NotNull(file.FailureReason);
        Assert.True(file.FailureReason!.Length <= 1024);
    }

    [Fact]
    public async Task RunAsync_FileScanUnavailableException_on_a_non_final_attempt_propagates_uncaught_with_no_status_change()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns<FileScanResult>(_ => throw new FileScanUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<FileScanUnavailableException>(() => sut.Job.RunAsync("file_1", CancellationToken.None, context));

        Assert.Equal(JobItemStatus.Queued, file.Status);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_FileScanUnavailableException_on_the_final_configured_attempt_marks_Failed_instead_of_leaving_Queued_forever()
    {
        var sut = MakeSut();
        var file = MakeQueuedFile();
        sut.Repository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(file);
        sut.FileStorage.OpenReadAsync(file.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns<FileScanResult>(_ => throw new FileScanUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("file_1", CancellationToken.None, context);

        Assert.Equal(JobItemStatus.Failed, file.Status);
        Assert.Equal("Scanning unavailable — retries exhausted", file.FailureReason);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
