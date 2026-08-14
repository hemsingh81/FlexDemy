using FlexDemy.Application.Common;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;

namespace FlexDemy.Application.Courses;

// Story 2.6: the hardened upload path -- validates, persists bytes via IFileStorageService, then
// hands off to an async Hangfire job (ScanFileJob) for the actual ClamAV scan (AD-15's
// tab-close-safety guarantee -- see this story's Dev Notes). Depends on ICourseService (AD-12:
// a feature's service may depend on another feature's service interface, never its repository
// interface directly) for the ownership+Draft-state guard.
public class CourseFileService(
    ICourseFileRepository repository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IFileStorageService fileStorage,
    ICourseService courseService,
    IScanFileJobEnqueuer scanFileJobEnqueuer,
    ICorrelationIdAccessor correlationIdAccessor) : ICourseFileService
{
    // PRD FR-11's own stated assumption: 50MB/file, per the existing prototype's stated limit.
    // Public/const (code-review patch) so CourseFilesController's [RequestSizeLimit] attribute
    // can reference this exact value instead of duplicating the number.
    public const long MaxFileContentLength = 50 * 1024 * 1024;

    // Code-review patch: matches the course_files.file_name column's HasMaxLength(255).
    private const int MaxFileNameLength = 255;

    // Server-side allowlist mirroring AC#1's "PDF/Word/TXT/Excel" -- the backend must not trust
    // client-side validation alone (same reasoning as CourseService's thumbnail allowlist).
    // Extension is looked up from here (the validated content-type), never from the caller's own
    // file name -- code-review patch: deriving it from the user-supplied name let a client send
    // an allowed Content-Type paired with an attacker-chosen extension (e.g. ".html"), which
    // would then be stored (and, before this same review's storage-split patch, served back) as
    // that extension.
    private static readonly Dictionary<string, string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = ".pdf",
        ["application/msword"] = ".doc",
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
        ["text/plain"] = ".txt",
        ["application/vnd.ms-excel"] = ".xls",
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = ".xlsx",
    };

    public async Task<CourseFileDto> UploadFileAsync(string courseId, Stream content, string fileName, string contentType, long contentLength, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        // Code-review patch: normalized before lookup -- a raw exact-match rejected legitimate
        // variants like "text/plain; charset=utf-8" or a differently-cased MIME type.
        var normalizedContentType = NormalizeContentType(contentType);
        if (!AllowedContentTypes.TryGetValue(normalizedContentType, out var extension))
            throw new ValidationException($"Unsupported file type '{contentType}'. Allowed: PDF, Word, TXT, Excel.");

        if (contentLength <= 0 || contentLength > MaxFileContentLength)
            throw new ValidationException($"File size must be between 1 byte and {MaxFileContentLength} bytes.");

        // Code-review patch: an over-length name would otherwise reach SaveChangesAsync only
        // after the bytes are already written to disk, throwing an unhandled DbUpdateException
        // and orphaning the just-saved file.
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > MaxFileNameLength)
            throw new ValidationException($"File name must be 1-{MaxFileNameLength} characters.");

        var storedFileName = $"{idGenerator.NewId()}{extension}";
        var storedUrl = await fileStorage.SaveAsync(content, storedFileName, normalizedContentType, category: "course-files", cancellationToken);

        var courseFile = new CourseFile
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            FileName = fileName,
            ContentType = normalizedContentType,
            SizeBytes = contentLength,
            StoredUrl = storedUrl,
            Status = JobItemStatus.Queued,
        };
        repository.Add(courseFile);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // AC#4: the HTTP response returns immediately with Status = "Queued" -- the scan runs
        // asynchronously, after this call returns, satisfying AD-15's tab-close-safety guarantee.
        //
        // Code-review patch: by this point the row is already committed. If scheduling the scan
        // itself fails (e.g. a transient Hangfire/Postgres hiccup), the row must not silently
        // stay Queued with no job ever coming -- mark it Failed instead of letting the exception
        // surface as an unhandled 500 for a file that, from the caller's perspective, did upload.
        try
        {
            scanFileJobEnqueuer.Enqueue(courseFile.Id, correlationIdAccessor.Current);
        }
        catch (Exception)
        {
            courseFile.Status = JobItemStatus.Failed;
            courseFile.FailureReason = "Could not schedule malware scan. Please retry.";
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return courseFile.ToDto();
    }

    public async Task<IReadOnlyList<CourseFileDto>> GetFilesAsync(string courseId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var files = await repository.GetByCourseIdAsync(courseId, cancellationToken);
        return files.Select(f => f.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<CourseFileDto>> GetPublishedFilesAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var files = await repository.GetByCourseIdAsync(courseId, cancellationToken);
        return files.Where(f => f.Status == JobItemStatus.Done).Select(f => f.ToDto()).ToList();
    }

    // Code-review patch: the authenticated read path for a course-file's bytes -- course-files
    // are no longer servable via app.UseStaticFiles() at all (LocalFileStorageService's
    // public/private category split), so this is the only way to retrieve one.
    public async Task<CourseFileDownload> DownloadFileAsync(string courseId, string fileId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        var file = await repository.GetByIdAsync(fileId, cancellationToken);
        // Same id-doesn't-exist vs id-exists-but-isn't-yours ambiguity CourseService.
        // GetCourseByIdAsync already deliberately preserves for a private resource: NotFoundException
        // either way, so a caller can't distinguish "no such file" from "not your course's file."
        if (file is null || file.CourseId != courseId)
            throw new NotFoundException(nameof(CourseFile), fileId);

        var content = await fileStorage.OpenReadAsync(file.StoredUrl, cancellationToken);
        return new CourseFileDownload(content, file.ContentType, file.FileName);
    }

    // Tutor-facing "delete this file (and its content)" -- with no more Chapter/Topic tree to
    // delete content from independently (Story removed), removing the CourseFile row is the
    // entire operation; its ParsedContent goes with it. Deletes the underlying stored bytes too,
    // best-effort -- a storage-delete failure must not block the row itself from being removed
    // (the tutor asked for this file gone; an orphaned blob is a cheap, recoverable cost, an
    // undeletable row is not).
    public async Task DeleteFileAsync(string courseId, string fileId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        var file = await repository.GetByIdAsync(fileId, cancellationToken);
        if (file is null || file.CourseId != courseId)
            throw new NotFoundException(nameof(CourseFile), fileId);

        repository.Remove(file);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            await fileStorage.DeleteAsync(file.StoredUrl, cancellationToken);
        }
        catch (Exception)
        {
            // Swallowed deliberately -- see this method's own header comment.
        }
    }

    private static string NormalizeContentType(string contentType) =>
        contentType.Split(';')[0].Trim();
}

// Code-review patch: carries what CourseFilesController.DownloadFile needs to write the HTTP
// response -- a plain data holder, not a DTO (never crosses the HTTP boundary as JSON).
public sealed record CourseFileDownload(Stream Content, string ContentType, string FileName);
