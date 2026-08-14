using System.Text.Json;
using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

// A snapshot now archives each of the course's uploaded files' raw parsed text (id/fileName/
// ParsedContent), not the Chapter/Topic/Subtopic tree -- see VersionService.cs's own header
// comment for why.
public class VersionServiceTests
{
    private sealed record Sut(
        VersionService Service,
        ICourseFileRepository CourseFileRepository,
        IVersionRepository Repository,
        ICourseService CourseService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork);

    private static Sut MakeSut()
    {
        var courseFileRepository = Substitute.For<ICourseFileRepository>();
        var repository = Substitute.For<IVersionRepository>();
        var courseService = Substitute.For<ICourseService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("version_1");
        var unitOfWork = Substitute.For<IUnitOfWork>();
        // Unconfigured, NSubstitute would return a completed Task WITHOUT ever invoking the
        // passed-in operation -- RestoreVersionAsync's real work happens inside that callback, so
        // this must actually run it for the tests below to exercise anything at all.
        unitOfWork.ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>())
            .Returns(async callInfo => await callInfo.Arg<Func<Task>>()());

        var service = new VersionService(courseFileRepository, repository, courseService, idGenerator, unitOfWork);
        return new Sut(service, courseFileRepository, repository, courseService, idGenerator, unitOfWork);
    }

    private static CourseFile MakeCourseFile(string id, string? parsedContent) => new()
    {
        Id = id,
        CourseId = "course_1",
        FileName = $"{id}.pdf",
        ContentType = "application/pdf",
        StoredUrl = $"/uploads/course-files/{id}.pdf",
        ParsedContent = parsedContent,
    };

    // -- CreateSnapshotAsync ---------------------------------------------------------------------

    [Fact]
    public async Task CreateSnapshotAsync_persists_one_CourseVersion_row_with_a_new_id_and_the_courseId()
    {
        var sut = MakeSut();
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.CreateSnapshotAsync("course_1");

        sut.Repository.Received(1).Add(Arg.Is<CourseVersion>(v => v.Id == "version_1" && v.CourseId == "course_1"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSnapshotAsync_serializes_each_files_id_name_and_parsed_content_into_SnapshotJson()
    {
        var sut = MakeSut();
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([MakeCourseFile("file_1", "Some parsed text")]);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());

        await sut.Service.CreateSnapshotAsync("course_1");

        Assert.NotNull(captured);
        using var document = JsonDocument.Parse(captured!.SnapshotJson);
        var file = document.RootElement.GetProperty("files").EnumerateArray().Single();
        Assert.Equal("file_1", file.GetProperty("id").GetString());
        Assert.Equal("file_1.pdf", file.GetProperty("fileName").GetString());
        Assert.Equal("Some parsed text", file.GetProperty("parsedContent").GetString());
    }

    [Fact]
    public async Task CreateSnapshotAsync_calls_SaveChangesAsync_exactly_once()
    {
        var sut = MakeSut();
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([MakeCourseFile("file_1", "text")]);

        await sut.Service.CreateSnapshotAsync("course_1");

        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Produces a real SnapshotJson via CreateSnapshotAsync itself (rather than hand-crafting the
    // exact camelCase shape by string), so GetVersionsAsync/RestoreVersionAsync tests below stay
    // correct even if the private SnapshotContent shape changes. Clears call tracking on the
    // shared mocks afterward so this setup call doesn't inflate the real test's own Received()
    // assertions.
    private static async Task<string> CaptureRealSnapshotJsonAsync(Sut sut, params CourseFile[] files)
    {
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(files);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());
        await sut.Service.CreateSnapshotAsync("course_1");

        sut.UnitOfWork.ClearReceivedCalls();
        sut.Repository.ClearReceivedCalls();
        sut.CourseFileRepository.ClearReceivedCalls();
        sut.CourseService.ClearReceivedCalls();

        return captured!.SnapshotJson;
    }

    // -- GetVersionsAsync -----------------------------------------------------------------------

    [Fact]
    public async Task GetVersionsAsync_requires_ownership()
    {
        var sut = MakeSut();
        sut.Repository.GetAllByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.GetVersionsAsync("course_1");

        await sut.CourseService.Received(1).EnsureOwnedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetVersionsAsync_returns_a_dto_per_version_with_the_file_count_derived_from_the_snapshot()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeCourseFile("file_1", "text"));
        var publishedAt = DateTimeOffset.UtcNow;
        sut.Repository.GetAllByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = publishedAt }]);

        var dtos = await sut.Service.GetVersionsAsync("course_1");

        var dto = Assert.Single(dtos);
        Assert.Equal("version_x", dto.Id);
        Assert.Equal(publishedAt, dto.PublishedAt);
        Assert.Equal(1, dto.FileCount);
    }

    // -- RestoreVersionAsync --------------------------------------------------------------------

    [Fact]
    public async Task RestoreVersionAsync_requires_ownership()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut);
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        await sut.CourseService.Received(1).EnsureOwnedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreVersionAsync_throws_NotFoundException_for_an_unknown_version_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((CourseVersion?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.RestoreVersionAsync("course_1", "missing"));
    }

    [Fact]
    public async Task RestoreVersionAsync_throws_NotFoundException_when_the_version_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "other_course", SnapshotJson = "{}", PublishedAt = DateTimeOffset.UtcNow });

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.RestoreVersionAsync("course_1", "version_x"));
    }

    [Fact]
    public async Task RestoreVersionAsync_writes_the_snapshots_text_back_onto_the_matching_still_existing_file()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeCourseFile("file_1", "archived text"));
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        // Simulate drift: the file's text changed (re-parsed, or otherwise edited) since this
        // version was published.
        var liveFile = MakeCourseFile("file_1", "newer text");
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([liveFile]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        Assert.Equal("archived text", liveFile.ParsedContent);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await sut.UnitOfWork.Received(1).ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreVersionAsync_leaves_a_file_added_since_the_snapshot_untouched()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeCourseFile("file_1", "archived text"));
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        var newerFile = MakeCourseFile("file_2", "uploaded after this version");
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([newerFile]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x"); // must not throw

        Assert.Equal("uploaded after this version", newerFile.ParsedContent);
    }

    [Fact]
    public async Task RestoreVersionAsync_calls_MarkDraftAsync_after_restoring_file_content()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut);
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        sut.CourseFileRepository.GetByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        await sut.CourseService.Received(1).MarkDraftAsync("course_1", Arg.Any<CancellationToken>());
    }
}
