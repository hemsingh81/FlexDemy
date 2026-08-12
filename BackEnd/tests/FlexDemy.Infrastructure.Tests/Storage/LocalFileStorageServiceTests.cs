using System.Text;
using FlexDemy.Infrastructure.Storage;
using Microsoft.AspNetCore.Hosting;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Storage;

// Uses real temp directories (not the actual wwwroot/content root) -- cleaned up after each test.
// WebRootPath and ContentRootPath are deliberately distinct temp roots so a test would fail loudly
// if a category ever wrote to the wrong one.
public class LocalFileStorageServiceTests : IDisposable
{
    private readonly string tempWebRoot = Path.Combine(Path.GetTempPath(), $"flexdemy-storage-tests-web-{Guid.NewGuid()}");
    private readonly string tempContentRoot = Path.Combine(Path.GetTempPath(), $"flexdemy-storage-tests-content-{Guid.NewGuid()}");

    private LocalFileStorageService MakeSut()
    {
        var environment = Substitute.For<IWebHostEnvironment>();
        environment.WebRootPath.Returns(tempWebRoot);
        environment.ContentRootPath.Returns(tempContentRoot);
        return new LocalFileStorageService(environment);
    }

    [Fact]
    public async Task SaveAsync_a_public_category_writes_under_WebRootPath_uploads_and_returns_the_expected_url()
    {
        var sut = MakeSut();
        var bytes = Encoding.UTF8.GetBytes("fake-image-bytes");
        using var content = new MemoryStream(bytes);

        var url = await sut.SaveAsync(content, "thumb_1.jpg", "image/jpeg", "course-thumbnails");

        Assert.Equal("/uploads/course-thumbnails/thumb_1.jpg", url);
        var writtenPath = Path.Combine(tempWebRoot, "uploads", "course-thumbnails", "thumb_1.jpg");
        Assert.True(File.Exists(writtenPath));
        Assert.Equal(bytes, await File.ReadAllBytesAsync(writtenPath));
    }

    [Fact]
    public async Task SaveAsync_creates_the_uploads_directory_when_it_does_not_exist_yet()
    {
        var sut = MakeSut();

        Assert.False(Directory.Exists(Path.Combine(tempWebRoot, "uploads", "course-thumbnails")));

        using var content = new MemoryStream([1, 2, 3]);
        await sut.SaveAsync(content, "thumb_2.png", "image/png", "course-thumbnails");

        Assert.True(Directory.Exists(Path.Combine(tempWebRoot, "uploads", "course-thumbnails")));
    }

    // Story 2.6 code-review patch: "course-files" is a private category -- it must land outside
    // WebRootPath entirely (invisible to app.UseStaticFiles()), not just in a different
    // subfolder under the same public root.
    [Fact]
    public async Task SaveAsync_a_private_category_writes_under_ContentRootPath_private_uploads_not_WebRootPath()
    {
        var sut = MakeSut();
        using var content = new MemoryStream([1]);

        var url = await sut.SaveAsync(content, "doc_1.pdf", "application/pdf", "course-files");

        Assert.Equal("/private-uploads/course-files/doc_1.pdf", url);
        Assert.True(File.Exists(Path.Combine(tempContentRoot, "private-uploads", "course-files", "doc_1.pdf")));
        Assert.False(Directory.Exists(Path.Combine(tempWebRoot, "uploads", "course-files")));
    }

    [Fact]
    public async Task OpenReadAsync_reads_back_the_exact_bytes_previously_saved_for_a_private_category()
    {
        var sut = MakeSut();
        var bytes = Encoding.UTF8.GetBytes("course-file-bytes");
        string url;
        using (var content = new MemoryStream(bytes))
        {
            url = await sut.SaveAsync(content, "doc_2.pdf", "application/pdf", "course-files");
        }

        await using var readBack = await sut.OpenReadAsync(url);
        using var buffer = new MemoryStream();
        await readBack.CopyToAsync(buffer);

        Assert.Equal(bytes, buffer.ToArray());
    }

    [Fact]
    public async Task OpenReadAsync_reads_back_the_exact_bytes_previously_saved_for_a_public_category()
    {
        var sut = MakeSut();
        var bytes = Encoding.UTF8.GetBytes("thumbnail-bytes");
        string url;
        using (var content = new MemoryStream(bytes))
        {
            url = await sut.SaveAsync(content, "thumb_3.jpg", "image/jpeg", "course-thumbnails");
        }

        await using var readBack = await sut.OpenReadAsync(url);
        using var buffer = new MemoryStream();
        await readBack.CopyToAsync(buffer);

        Assert.Equal(bytes, buffer.ToArray());
    }

    [Fact]
    public async Task DeleteAsync_removes_the_file_at_the_given_storedUrl_for_a_private_category()
    {
        var sut = MakeSut();
        using var content = new MemoryStream([1, 2, 3]);
        var url = await sut.SaveAsync(content, "doc_3.pdf", "application/pdf", "course-files");
        var writtenPath = Path.Combine(tempContentRoot, "private-uploads", "course-files", "doc_3.pdf");
        Assert.True(File.Exists(writtenPath));

        await sut.DeleteAsync(url);

        Assert.False(File.Exists(writtenPath));
    }

    public void Dispose()
    {
        if (Directory.Exists(tempWebRoot))
            Directory.Delete(tempWebRoot, recursive: true);
        if (Directory.Exists(tempContentRoot))
            Directory.Delete(tempContentRoot, recursive: true);
    }
}
