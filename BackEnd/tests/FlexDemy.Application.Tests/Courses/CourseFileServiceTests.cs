using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class CourseFileServiceTests
{
    private sealed record Sut(
        CourseFileService Service,
        ICourseFileRepository Repository,
        IUnitOfWork UnitOfWork,
        IIdGenerator IdGenerator,
        IFileStorageService FileStorage,
        ICourseService CourseService,
        IScanFileJobEnqueuer Enqueuer,
        ICorrelationIdAccessor CorrelationIdAccessor);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<ICourseFileRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var courseService = Substitute.For<ICourseService>();
        var enqueuer = Substitute.For<IScanFileJobEnqueuer>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();
        var service = new CourseFileService(repository, unitOfWork, idGenerator, fileStorage, courseService, enqueuer, correlationIdAccessor);
        return new Sut(service, repository, unitOfWork, idGenerator, fileStorage, courseService, enqueuer, correlationIdAccessor);
    }

    // -- UploadFileAsync ------------------------------------------------------------------------

    [Fact]
    public async Task UploadFileAsync_happy_path_saves_the_file_creates_a_Queued_row_and_enqueues_a_scan_job()
    {
        var sut = MakeSut();
        // Code-review patch: order matches the real call sites exactly -- UploadFileAsync's
        // *first* NewId() call generates the stored file name (used to build the SaveAsync
        // target), its *second* generates CourseFile.Id. Getting this backwards previously made
        // the stub misleading (though harmless, since nothing asserted on the actual Id).
        sut.IdGenerator.NewId().Returns("storedname_new", "file_new");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "application/pdf", "course-files", Arg.Any<CancellationToken>())
            .Returns("/uploads/course-files/storedname_new.pdf");
        using var content = new MemoryStream([1, 2, 3]);

        var result = await sut.Service.UploadFileAsync("draft_1", content, "notes.pdf", "application/pdf", 3);

        await sut.CourseService.Received(1).EnsureOwnedDraftAsync("draft_1", Arg.Any<CancellationToken>());
        await sut.FileStorage.Received(1).SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "application/pdf", "course-files", Arg.Any<CancellationToken>());
        Assert.Equal("file_new", result.Id);
        sut.Repository.Received(1).Add(Arg.Is<CourseFile>(f =>
            f.Id == "file_new" && f.CourseId == "draft_1" && f.FileName == "notes.pdf" && f.Status == JobItemStatus.Queued));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        sut.Enqueuer.Received(1).Enqueue(Arg.Any<string>(), Arg.Any<string?>());
        Assert.Equal("notes.pdf", result.FileName);
        Assert.Equal(nameof(JobItemStatus.Queued), result.Status);
    }

    // Code-review patch: Story 4.1's own core AC (the correlation ID read from the accessor is
    // forwarded to the scan job enqueuer) was previously untested at this call site -- the
    // accessor was substituted but never exposed on Sut, so no test could configure or assert it.
    [Fact]
    public async Task UploadFileAsync_forwards_the_current_correlation_id_to_the_scan_job_enqueuer()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns("corr-abc");
        sut.IdGenerator.NewId().Returns("storedname_new", "file_new");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "application/pdf", "course-files", Arg.Any<CancellationToken>())
            .Returns("/uploads/course-files/storedname_new.pdf");
        using var content = new MemoryStream([1, 2, 3]);

        await sut.Service.UploadFileAsync("draft_1", content, "notes.pdf", "application/pdf", 3);

        sut.Enqueuer.Received(1).Enqueue("file_new", "corr-abc");
    }

    [Theory]
    [InlineData("image/png")]
    [InlineData("application/zip")]
    [InlineData("")]
    public async Task UploadFileAsync_throws_ValidationException_for_a_disallowed_content_type(string contentType)
    {
        var sut = MakeSut();
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UploadFileAsync("draft_1", content, "file.bin", contentType, 1));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!);
        sut.Enqueuer.DidNotReceiveWithAnyArgs().Enqueue(default!, default!);
    }

    [Fact]
    public async Task UploadFileAsync_throws_ValidationException_when_oversized()
    {
        var sut = MakeSut();
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UploadFileAsync("draft_1", content, "big.pdf", "application/pdf", 50 * 1024 * 1024 + 1));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!);
    }

    [Fact]
    public async Task UploadFileAsync_throws_ValidationException_for_zero_size()
    {
        var sut = MakeSut();
        using var content = new MemoryStream();

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UploadFileAsync("draft_1", content, "empty.pdf", "application/pdf", 0));
    }

    [Fact]
    public async Task UploadFileAsync_propagates_ownership_Draft_state_failures_from_EnsureOwnedDraftAsync_before_storing_or_enqueuing()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedDraftAsync("draft_1", Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new UnauthorizedAppException("You do not have permission to modify this course draft."));
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() =>
            sut.Service.UploadFileAsync("draft_1", content, "notes.pdf", "application/pdf", 1));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!);
        sut.Enqueuer.DidNotReceiveWithAnyArgs().Enqueue(default!, default!);
    }

    // Code-review patch: a charset-suffixed/differently-cased content-type is normalized before
    // the allowlist lookup, not rejected outright.
    [Theory]
    [InlineData("text/plain; charset=utf-8")]
    [InlineData("APPLICATION/PDF")]
    [InlineData("  application/pdf  ")]
    public async Task UploadFileAsync_accepts_a_normalized_variant_of_an_allowed_content_type(string contentType)
    {
        var sut = MakeSut();
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), "course-files", Arg.Any<CancellationToken>())
            .Returns("/private-uploads/course-files/x");
        using var content = new MemoryStream([1]);

        var result = await sut.Service.UploadFileAsync("draft_1", content, "notes.pdf", contentType, 1);

        Assert.Equal(nameof(JobItemStatus.Queued), result.Status);
    }

    // Code-review patch: an over-length file name must be rejected before anything is stored.
    [Fact]
    public async Task UploadFileAsync_throws_ValidationException_for_an_over_length_file_name()
    {
        var sut = MakeSut();
        var overLongName = new string('a', 256) + ".pdf";
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UploadFileAsync("draft_1", content, overLongName, "application/pdf", 1));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!);
    }

    // Code-review patch: if scheduling the scan job itself throws (after the row is already
    // committed Queued), the row must be marked Failed, not left silently Queued forever with an
    // unhandled exception surfacing to the caller.
    [Fact]
    public async Task UploadFileAsync_marks_the_row_Failed_when_enqueuing_the_scan_job_throws()
    {
        var sut = MakeSut();
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), "course-files", Arg.Any<CancellationToken>())
            .Returns("/private-uploads/course-files/x.pdf");
        sut.Enqueuer.When(e => e.Enqueue(Arg.Any<string>(), Arg.Any<string?>())).Do(_ => throw new InvalidOperationException("Hangfire storage unavailable"));
        using var content = new MemoryStream([1]);

        var result = await sut.Service.UploadFileAsync("draft_1", content, "notes.pdf", "application/pdf", 1);

        Assert.Equal(nameof(JobItemStatus.Failed), result.Status);
        Assert.Equal("Could not schedule malware scan. Please retry.", result.FailureReason);
        await sut.UnitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // -- DownloadFileAsync ------------------------------------------------------------------------

    [Fact]
    public async Task DownloadFileAsync_returns_the_files_content_stream_content_type_and_name()
    {
        var sut = MakeSut();
        var file = new CourseFile { Id = "f1", CourseId = "draft_1", FileName = "notes.pdf", ContentType = "application/pdf", StoredUrl = "/private-uploads/course-files/x.pdf" };
        sut.Repository.GetByIdAsync("f1", Arg.Any<CancellationToken>()).Returns(file);
        using var stream = new MemoryStream([1, 2, 3]);
        sut.FileStorage.OpenReadAsync("/private-uploads/course-files/x.pdf", Arg.Any<CancellationToken>()).Returns(stream);

        var result = await sut.Service.DownloadFileAsync("draft_1", "f1");

        await sut.CourseService.Received(1).EnsureOwnedDraftAsync("draft_1", Arg.Any<CancellationToken>());
        Assert.Same(stream, result.Content);
        Assert.Equal("application/pdf", result.ContentType);
        Assert.Equal("notes.pdf", result.FileName);
    }

    [Fact]
    public async Task DownloadFileAsync_throws_NotFoundException_for_an_unknown_file_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((CourseFile?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DownloadFileAsync("draft_1", "missing"));
    }

    // Code-review patch: a file id that exists but belongs to a different course must not be
    // distinguishable from "doesn't exist" -- same private-resource-hiding reasoning as
    // CourseService.GetCourseByIdAsync's non-owner guard.
    [Fact]
    public async Task DownloadFileAsync_throws_NotFoundException_for_a_file_belonging_to_a_different_course()
    {
        var sut = MakeSut();
        var file = new CourseFile { Id = "f1", CourseId = "other_course", FileName = "notes.pdf", ContentType = "application/pdf", StoredUrl = "/private-uploads/course-files/x.pdf" };
        sut.Repository.GetByIdAsync("f1", Arg.Any<CancellationToken>()).Returns(file);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DownloadFileAsync("draft_1", "f1"));
    }

    [Fact]
    public async Task DownloadFileAsync_propagates_ownership_Draft_state_failures_from_EnsureOwnedDraftAsync()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedDraftAsync("draft_1", Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new UnauthorizedAppException("You do not have permission to modify this course draft."));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.DownloadFileAsync("draft_1", "f1"));

        await sut.Repository.DidNotReceiveWithAnyArgs().GetByIdAsync(default!);
    }

    // -- GetFilesAsync ----------------------------------------------------------------------------

    [Fact]
    public async Task GetFilesAsync_returns_the_mapped_dtos_for_the_course()
    {
        var sut = MakeSut();
        var files = new List<CourseFile>
        {
            new() { Id = "f1", CourseId = "draft_1", FileName = "a.pdf", ContentType = "application/pdf", StoredUrl = "/u/a.pdf", Status = JobItemStatus.Done },
            new() { Id = "f2", CourseId = "draft_1", FileName = "b.pdf", ContentType = "application/pdf", StoredUrl = "/u/b.pdf", Status = JobItemStatus.Failed, FailureReason = "Malware detected: Eicar-Test-Signature" },
        };
        sut.Repository.GetByCourseIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(files);

        var result = await sut.Service.GetFilesAsync("draft_1");

        await sut.CourseService.Received(1).EnsureOwnedDraftAsync("draft_1", Arg.Any<CancellationToken>());
        Assert.Equal(2, result.Count);
        Assert.Equal("Malware detected: Eicar-Test-Signature", result.Single(f => f.Id == "f2").FailureReason);
    }
}
