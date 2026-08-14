using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Story 2.6: all three actions reuse the existing CoursesCreate policy
// (Master + Tutor), matching every other Courses-feature endpoint.
[ApiController]
[Route("api/v1/courses/{courseId}/files")]
public class CourseFilesController(ICourseFileService courseFileService) : ControllerBase
{
    // Single file per request (mirrors Story 2.4's thumbnail-upload pattern) -- "multi-file
    // upload" is a frontend concern of calling this once per file. No Location header/
    // CreatedAtAction -- DownloadFile below is a download stream, not a single-file-by-id JSON
    // GET; a bare 201 with the created resource in the body is sufficient (matches
    // CoursesController's own thumbnail-upload action).
    [HttpPost]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    [RequestSizeLimit(CourseFileService.MaxFileContentLength)]
    public async Task<ActionResult<CourseFileDto>> UploadFile(string courseId, [FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        // Code-review patch: an omitted multipart part binds null, not a zero-length IFormFile --
        // without this guard, file.OpenReadStream() below throws an unhandled NullReferenceException.
        if (file is null)
            return BadRequest("A file is required.");

        await using var stream = file.OpenReadStream();
        var courseFile = await courseFileService.UploadFileAsync(courseId, stream, file.FileName, file.ContentType, file.Length, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, courseFile);
    }

    [HttpGet]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<IReadOnlyList<CourseFileDto>>> GetFiles(string courseId, CancellationToken cancellationToken)
    {
        var files = await courseFileService.GetFilesAsync(courseId, cancellationToken);
        return Ok(files);
    }

    // Code-review patch: course-files are no longer reachable via app.UseStaticFiles() at all
    // (LocalFileStorageService's public/private category split) -- this authenticated action is
    // now the only way to read one back.
    [HttpGet("{fileId}/download")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> DownloadFile(string courseId, string fileId, CancellationToken cancellationToken)
    {
        var download = await courseFileService.DownloadFileAsync(courseId, fileId, cancellationToken);
        return File(download.Content, download.ContentType, download.FileName);
    }

    // Tutor-facing "delete this file (and its content)" -- removing the row removes its
    // ParsedContent with it; there's no separate Chapter/Topic tree to clean up anymore.
    [HttpDelete("{fileId}")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> DeleteFile(string courseId, string fileId, CancellationToken cancellationToken)
    {
        await courseFileService.DeleteFileAsync(courseId, fileId, cancellationToken);
        return NoContent();
    }
}
