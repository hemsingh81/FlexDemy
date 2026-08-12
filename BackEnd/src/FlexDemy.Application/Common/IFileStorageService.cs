namespace FlexDemy.Application.Common;

// Story 2.4: interim, UNSCANNED file storage. Story 2.6 ("File Upload, Malware Scanning &
// Secure Storage") hardens the upload path in front of this service (ClamAV scanning via
// IFileScanner) and extends it with category-scoped storage plus read-back/delete, needed by
// ScanFileJob (read the bytes back to scan them, delete them on a malware-positive result) and,
// later, Story 2.7's parsing. Code-review patch: `category` also controls public reachability --
// the implementation decides per category whether a file is served directly (thumbnails) or only
// reachable through an authenticated controller action (course-content source files); callers
// don't need to know which.
public interface IFileStorageService
{
    Task<string> SaveAsync(Stream content, string fileName, string contentType, string category, CancellationToken cancellationToken = default);

    Task<Stream> OpenReadAsync(string storedUrl, CancellationToken cancellationToken = default);

    Task DeleteAsync(string storedUrl, CancellationToken cancellationToken = default);
}
