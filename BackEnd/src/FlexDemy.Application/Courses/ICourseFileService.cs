namespace FlexDemy.Application.Courses;

// AD-3: plain service interface, no mediator.
public interface ICourseFileService
{
    Task<CourseFileDto> UploadFileAsync(string courseId, Stream content, string fileName, string contentType, long contentLength, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourseFileDto>> GetFilesAsync(string courseId, CancellationToken cancellationToken = default);

    // Student-facing read: no ownership check (mirrors CoursesController.GetCourseById's own
    // open-read shape) -- only Done files are returned, since a queued/parsing/failed row has
    // nothing meaningful to show a reader.
    Task<IReadOnlyList<CourseFileDto>> GetPublishedFilesAsync(string courseId, CancellationToken cancellationToken = default);

    // Code-review patch: the only authenticated way to read a course-file's bytes back --
    // course-files are no longer reachable via app.UseStaticFiles().
    Task<CourseFileDownload> DownloadFileAsync(string courseId, string fileId, CancellationToken cancellationToken = default);

    // Tutor-facing "delete this file (and its content)" -- with no more Chapter/Topic tree to
    // delete content from independently, removing the CourseFile row is the entire operation;
    // its ParsedContent goes with it.
    Task DeleteFileAsync(string courseId, string fileId, CancellationToken cancellationToken = default);
}
