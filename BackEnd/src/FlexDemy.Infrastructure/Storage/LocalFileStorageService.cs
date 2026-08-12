using FlexDemy.Application.Common;
using Microsoft.AspNetCore.Hosting;

namespace FlexDemy.Infrastructure.Storage;

// Local-disk implementation of IFileStorageService. Story 2.6 code-review patch: not every
// category is safe to serve unauthenticated -- "course-thumbnails" are genuinely public images
// (course listings) and still live under wwwroot so app.UseStaticFiles() (Program.cs) can serve
// them directly, but "course-files" (a tutor's uploaded source documents, possibly not yet
// scanned or malware-positive) must never be reachable that way. PrivateCategories writes those
// under ContentRootPath instead -- outside wwwroot, invisible to UseStaticFiles -- and they can
// only be read back through CourseFilesController's authenticated download action.
public class LocalFileStorageService(IWebHostEnvironment environment) : IFileStorageService
{
    private const string PublicUploadsRelativePath = "uploads";
    private const string PrivateUploadsRelativePath = "private-uploads";

    private static readonly HashSet<string> PrivateCategories = new(StringComparer.OrdinalIgnoreCase) { "course-files" };

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, string category, CancellationToken cancellationToken = default)
    {
        var (root, urlPrefix) = ResolveRoot(category);
        var targetDirectory = Path.Combine(root, urlPrefix, category);
        Directory.CreateDirectory(targetDirectory);

        var targetPath = Path.Combine(targetDirectory, fileName);
        await using (var fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write))
        {
            await content.CopyToAsync(fileStream, cancellationToken);
        }

        return $"/{urlPrefix}/{category}/{fileName}";
    }

    public Task<Stream> OpenReadAsync(string storedUrl, CancellationToken cancellationToken = default)
    {
        Stream stream = new FileStream(ResolvePath(storedUrl), FileMode.Open, FileAccess.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storedUrl, CancellationToken cancellationToken = default)
    {
        File.Delete(ResolvePath(storedUrl));
        return Task.CompletedTask;
    }

    private string WebRootPath() =>
        environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");

    private (string Root, string UrlPrefix) ResolveRoot(string category) =>
        PrivateCategories.Contains(category)
            ? (environment.ContentRootPath, PrivateUploadsRelativePath)
            : (WebRootPath(), PublicUploadsRelativePath);

    // storedUrl's own prefix ("/uploads/..." vs "/private-uploads/...") says which root it lives
    // under -- no need to know the category again here.
    private string ResolvePath(string storedUrl)
    {
        var trimmed = storedUrl.TrimStart('/');
        var root = trimmed.StartsWith(PrivateUploadsRelativePath + "/", StringComparison.OrdinalIgnoreCase)
            ? environment.ContentRootPath
            : WebRootPath();
        return Path.Combine(root, trimmed.Replace('/', Path.DirectorySeparatorChar));
    }
}
