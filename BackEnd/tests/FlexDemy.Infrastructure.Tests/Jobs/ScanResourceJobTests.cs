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

// Story 8.1 -- mirrors ScanFileJobTests.cs's own structure/patterns (same test-where-the-subject-
// lives convention as that file's own header comment explains).
public class ScanResourceJobTests
{
    private sealed record Sut(ScanResourceJob Job, IContentRepository Repository, IUnitOfWork UnitOfWork, IFileStorageService FileStorage, IFileScanner FileScanner, ISvgSanitizer SvgSanitizer, ICorrelationIdAccessor CorrelationIdAccessor, IErrorCaptureService ErrorCaptureService);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IContentRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var fileScanner = Substitute.For<IFileScanner>();
        var svgSanitizer = Substitute.For<ISvgSanitizer>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var job = new ScanResourceJob(repository, unitOfWork, fileStorage, fileScanner, svgSanitizer, correlationIdAccessor, errorCaptureService);
        return new Sut(job, repository, unitOfWork, fileStorage, fileScanner, svgSanitizer, correlationIdAccessor, errorCaptureService);
    }

    private static Resource MakeQueuedResource(string id = "resource_1", string contentType = "application/pdf") => new()
    {
        Id = id,
        OwnerType = ContentOwnerType.Page,
        OwnerId = "page_1",
        Label = "Notes",
        FileName = "notes.pdf",
        ContentType = contentType,
        StoredUrl = "/uploads/course-resources/notes.pdf",
        Status = JobItemStatus.Queued,
    };

    private static PerformContext MakePerformContext(int? retryCount)
    {
        var method = typeof(IScanResourceJob).GetMethod(nameof(IScanResourceJob.RunAsync))!;
        var job = new Job(typeof(IScanResourceJob), method, "resource_1", null!, CancellationToken.None, null!);
        var backgroundJob = new BackgroundJob("job_1", job, DateTime.UtcNow);
        var connection = Substitute.For<IStorageConnection>();
        connection.GetJobParameter("job_1", "RetryCount").Returns(retryCount?.ToString());
        var cancellationToken = Substitute.For<Hangfire.IJobCancellationToken>();
#pragma warning disable CS0618
        return new PerformContext(connection, backgroundJob, cancellationToken);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task RunAsync_a_clean_scan_of_a_non_SVG_file_skips_sanitization_and_sets_Status_Done()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource(contentType: "application/pdf");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Done, resource.Status);
        await sut.SvgSanitizer.DidNotReceiveWithAnyArgs().SanitizeAsync(default!, default);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_clean_scan_of_an_SVG_file_sanitizes_and_resaves_it_then_sets_Status_Done()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource(contentType: "image/svg+xml");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));
        var sanitizedStream = new MemoryStream([9, 9, 9]);
        sut.SvgSanitizer.SanitizeAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(sanitizedStream);

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        await sut.SvgSanitizer.Received(1).SanitizeAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>());
        await sut.FileStorage.Received(1).SaveAsync(sanitizedStream, "notes.pdf", "image/svg+xml", "course-resources", Arg.Any<CancellationToken>());
        Assert.Equal(JobItemStatus.Done, resource.Status);
    }

    [Fact]
    public async Task RunAsync_an_unparseable_SVG_marks_Failed_with_the_sanitizers_message_and_never_flips_to_Done()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource(contentType: "image/svg+xml");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));
        sut.SvgSanitizer.SanitizeAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns<Task<Stream>>(_ => throw new SvgSanitizationException("The uploaded file is not a valid SVG document."));

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, resource.Status);
        Assert.Contains("not a valid SVG", resource.FailureReason);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!, default);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_a_malware_positive_scan_sets_Status_Failed_and_deletes_the_stored_file_never_sanitizing()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource(contentType: "image/svg+xml");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(false, "Eicar-Test-Signature"));

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        Assert.Equal(JobItemStatus.Failed, resource.Status);
        Assert.Contains("Eicar-Test-Signature", resource.FailureReason);
        await sut.FileStorage.Received(1).DeleteAsync(resource.StoredUrl, Arg.Any<CancellationToken>());
        await sut.SvgSanitizer.DidNotReceiveWithAnyArgs().SanitizeAsync(default!, default);
    }

    [Theory]
    [InlineData(JobItemStatus.Failed)]
    [InlineData(JobItemStatus.Done)]
    public async Task RunAsync_is_a_no_op_for_a_row_that_is_no_longer_Queued(JobItemStatus status)
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource();
        resource.Status = status;
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        await sut.FileStorage.DidNotReceiveWithAnyArgs().OpenReadAsync(default!);
        await sut.FileScanner.DidNotReceiveWithAnyArgs().ScanAsync(default!);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_sets_the_correlation_accessor_from_the_argument()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource();
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1, 2, 3]));
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(true, null));

        await sut.Job.RunAsync("resource_1", "corr-abc", CancellationToken.None);

        sut.CorrelationIdAccessor.Received(1).Set("corr-abc");
    }

    [Fact]
    public async Task RunAsync_a_non_FileScanUnavailableException_on_the_final_attempt_marks_Failed_and_captures_the_error()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource();
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>())
            .Returns<Task<Stream>>(_ => throw new FileNotFoundException("stored file missing"));
        var context = MakePerformContext(retryCount: 4); // attempt 5 of 5 -- the last

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None, context);

        Assert.Equal(JobItemStatus.Failed, resource.Status);
        Assert.Contains("Scan failed", resource.FailureReason);
        await sut.ErrorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.ExceptionType == "FileNotFoundException"
                && r.RelatedEntityType == nameof(Resource) && r.RelatedEntityId == "resource_1" && r.IsBackgroundJobFailure),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_FileScanUnavailableException_on_a_non_final_attempt_propagates_uncaught_with_no_status_change()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource();
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>())
            .Returns<Task<Stream>>(_ => throw new FileScanUnavailableException("unreachable"));
        var context = MakePerformContext(retryCount: 1); // attempt 2 of 5 -- not the last

        await Assert.ThrowsAsync<FileScanUnavailableException>(() => sut.Job.RunAsync("resource_1", null, CancellationToken.None, context));

        Assert.Equal(JobItemStatus.Queued, resource.Status);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RunAsync_truncates_an_over_length_FailureReason_to_the_column_limit()
    {
        var sut = MakeSut();
        var resource = MakeQueuedResource();
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(_ => new MemoryStream([1]));
        var overLongThreatName = new string('x', 2000);
        sut.FileScanner.ScanAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>()).Returns(new FileScanResult(false, overLongThreatName));

        await sut.Job.RunAsync("resource_1", null, CancellationToken.None);

        Assert.NotNull(resource.FailureReason);
        Assert.True(resource.FailureReason!.Length <= Resource.FailureReasonMaxLength);
    }
}
