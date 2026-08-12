namespace FlexDemy.Application.Courses;

// AD-3: plain service interface, no mediator.
public interface ICourseFileService
{
    Task<CourseFileDto> UploadFileAsync(string courseId, Stream content, string fileName, string contentType, long contentLength, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourseFileDto>> GetFilesAsync(string courseId, CancellationToken cancellationToken = default);

    // Code-review patch: the only authenticated way to read a course-file's bytes back --
    // course-files are no longer reachable via app.UseStaticFiles().
    Task<CourseFileDownload> DownloadFileAsync(string courseId, string fileId, CancellationToken cancellationToken = default);
}
