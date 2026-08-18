using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-20: [Route("api/v1/courses/{courseId}/content")] -- Chapter/Topic/Subtopic/Page/Resource
// CRUD+move+confirm+GET .../document all live under this one controller, extended by later
// stories rather than duplicated. No [Authorize(Policy = ...)] attribute on any action here --
// the ownership checks inside ContentService are the real gate (same shape as
// CoursesController.GetCourseContent's existing unauthenticated-route-but-service-checked
// pattern). AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call.
[ApiController]
[Route("api/v1/courses/{courseId}/content")]
public class ContentController(IContentService contentService) : ControllerBase
{
    [HttpGet("chapters")]
    public async Task<ActionResult<IReadOnlyList<ChapterSummaryDto>>> GetChapters(string courseId, CancellationToken cancellationToken)
    {
        var chapters = await contentService.GetChapterListAsync(courseId, cancellationToken);
        return Ok(chapters);
    }

    [HttpGet("chapters/{chapterId}/document")]
    public async Task<ActionResult<ChapterDocumentDto>> GetChapterDocument(string courseId, string chapterId, CancellationToken cancellationToken)
    {
        var document = await contentService.GetChapterDocumentAsync(courseId, chapterId, cancellationToken);
        return Ok(document);
    }

    [HttpPost("chapters")]
    public async Task<ActionResult<ChapterSummaryDto>> CreateChapter(string courseId, CreateChapterRequest request, CancellationToken cancellationToken)
    {
        var chapter = await contentService.CreateChapterAsync(courseId, request, cancellationToken);
        return CreatedAtAction(nameof(GetChapterDocument), new { courseId, chapterId = chapter.Id }, chapter);
    }

    [HttpPut("chapters/{chapterId}")]
    public async Task<ActionResult<ChapterDocumentDto>> UpdateChapter(string courseId, string chapterId, UpdateChapterRequest request, CancellationToken cancellationToken)
    {
        var document = await contentService.UpdateChapterAsync(courseId, chapterId, request, cancellationToken);
        return Ok(document);
    }

    // Story 7.2 additions --

    [HttpGet("chapters/{chapterId}/delete-impact")]
    public async Task<ActionResult<DeleteImpactDto>> GetChapterDeleteImpact(string courseId, string chapterId, CancellationToken cancellationToken)
    {
        var impact = await contentService.GetChapterDeleteImpactAsync(courseId, chapterId, cancellationToken);
        return Ok(impact);
    }

    [HttpDelete("chapters/{chapterId}")]
    public async Task<IActionResult> DeleteChapter(string courseId, string chapterId, CancellationToken cancellationToken)
    {
        await contentService.DeleteChapterAsync(courseId, chapterId, cancellationToken);
        return NoContent();
    }

    [HttpPut("chapters/{chapterId}/reorder")]
    public async Task<IActionResult> ReorderChapter(string courseId, string chapterId, ReorderRequest request, CancellationToken cancellationToken)
    {
        await contentService.ReorderChapterAsync(courseId, chapterId, request.Direction, cancellationToken);
        return NoContent();
    }

    [HttpPost("chapters/{chapterId}/topics")]
    public async Task<ActionResult<TopicDocumentDto>> CreateTopic(string courseId, string chapterId, CreateTopicRequest request, CancellationToken cancellationToken)
    {
        var topic = await contentService.CreateTopicAsync(courseId, chapterId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, topic);
    }

    [HttpPut("topics/{topicId}")]
    public async Task<ActionResult<TopicDocumentDto>> UpdateTopic(string courseId, string topicId, UpdateTopicRequest request, CancellationToken cancellationToken)
    {
        var topic = await contentService.UpdateTopicAsync(courseId, topicId, request, cancellationToken);
        return Ok(topic);
    }

    [HttpGet("topics/{topicId}/delete-impact")]
    public async Task<ActionResult<DeleteImpactDto>> GetTopicDeleteImpact(string courseId, string topicId, CancellationToken cancellationToken)
    {
        var impact = await contentService.GetTopicDeleteImpactAsync(courseId, topicId, cancellationToken);
        return Ok(impact);
    }

    [HttpDelete("topics/{topicId}")]
    public async Task<IActionResult> DeleteTopic(string courseId, string topicId, CancellationToken cancellationToken)
    {
        await contentService.DeleteTopicAsync(courseId, topicId, cancellationToken);
        return NoContent();
    }

    [HttpPut("topics/{topicId}/reorder")]
    public async Task<IActionResult> ReorderTopic(string courseId, string topicId, ReorderRequest request, CancellationToken cancellationToken)
    {
        await contentService.ReorderTopicAsync(courseId, topicId, request.Direction, cancellationToken);
        return NoContent();
    }

    [HttpPost("topics/{topicId}/subtopics")]
    public async Task<ActionResult<SubtopicDocumentDto>> CreateSubtopic(string courseId, string topicId, CreateSubtopicRequest request, CancellationToken cancellationToken)
    {
        var subtopic = await contentService.CreateSubtopicAsync(courseId, topicId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, subtopic);
    }

    [HttpPut("subtopics/{subtopicId}")]
    public async Task<ActionResult<SubtopicDocumentDto>> UpdateSubtopic(string courseId, string subtopicId, UpdateSubtopicRequest request, CancellationToken cancellationToken)
    {
        var subtopic = await contentService.UpdateSubtopicAsync(courseId, subtopicId, request, cancellationToken);
        return Ok(subtopic);
    }

    [HttpGet("subtopics/{subtopicId}/delete-impact")]
    public async Task<ActionResult<DeleteImpactDto>> GetSubtopicDeleteImpact(string courseId, string subtopicId, CancellationToken cancellationToken)
    {
        var impact = await contentService.GetSubtopicDeleteImpactAsync(courseId, subtopicId, cancellationToken);
        return Ok(impact);
    }

    [HttpDelete("subtopics/{subtopicId}")]
    public async Task<IActionResult> DeleteSubtopic(string courseId, string subtopicId, CancellationToken cancellationToken)
    {
        await contentService.DeleteSubtopicAsync(courseId, subtopicId, cancellationToken);
        return NoContent();
    }

    [HttpPut("subtopics/{subtopicId}/reorder")]
    public async Task<IActionResult> ReorderSubtopic(string courseId, string subtopicId, ReorderRequest request, CancellationToken cancellationToken)
    {
        await contentService.ReorderSubtopicAsync(courseId, subtopicId, request.Direction, cancellationToken);
        return NoContent();
    }

    // Story 7.3 additions --

    [HttpPost("pages")]
    public async Task<ActionResult<PageDocumentDto>> CreatePage(string courseId, CreatePageRequest request, CancellationToken cancellationToken)
    {
        var page = await contentService.CreatePageAsync(courseId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, page);
    }

    [HttpGet("pages/{pageId}")]
    public async Task<ActionResult<PageDocumentDto>> GetPage(string courseId, string pageId, CancellationToken cancellationToken)
    {
        var page = await contentService.GetPageAsync(courseId, pageId, cancellationToken);
        return Ok(page);
    }

    [HttpPut("pages/{pageId}")]
    public async Task<ActionResult<PageDocumentDto>> UpdatePage(string courseId, string pageId, UpdatePageRequest request, CancellationToken cancellationToken)
    {
        var page = await contentService.UpdatePageAsync(courseId, pageId, request, cancellationToken);
        return Ok(page);
    }

    [HttpGet("pages/{pageId}/delete-impact")]
    public async Task<ActionResult<DeleteImpactDto>> GetPageDeleteImpact(string courseId, string pageId, CancellationToken cancellationToken)
    {
        var impact = await contentService.GetPageDeleteImpactAsync(courseId, pageId, cancellationToken);
        return Ok(impact);
    }

    [HttpDelete("pages/{pageId}")]
    public async Task<IActionResult> DeletePage(string courseId, string pageId, CancellationToken cancellationToken)
    {
        await contentService.DeletePageAsync(courseId, pageId, cancellationToken);
        return NoContent();
    }

    [HttpPut("pages/{pageId}/reorder")]
    public async Task<IActionResult> ReorderPage(string courseId, string pageId, ReorderRequest request, CancellationToken cancellationToken)
    {
        await contentService.ReorderPageAsync(courseId, pageId, request.Direction, cancellationToken);
        return NoContent();
    }

    [HttpPut("pages/{pageId}/move")]
    public async Task<ActionResult<PageDocumentDto>> MovePage(string courseId, string pageId, MovePageRequest request, CancellationToken cancellationToken)
    {
        var page = await contentService.MovePageAsync(courseId, pageId, request, cancellationToken);
        return Ok(page);
    }

    // Story 7.4 additions --

    [HttpGet("outline")]
    public async Task<ActionResult<OutlineDto>> GetOutline(string courseId, CancellationToken cancellationToken)
    {
        var outline = await contentService.GetOutlineAsync(courseId, cancellationToken);
        return Ok(outline);
    }

    // Story 8.1 additions -- mirrors CourseFilesController.UploadFile's [FromForm] IFormFile
    // pattern (single file per request) and CoursesController.AddThumbnail's multi-field
    // [FromForm] precedent for the remaining scalar fields.
    // GET (not embedded-only) so the frontend's Learning Resources block can poll a single
    // owner's resources for scan-status transitions (Queued -> Done/Failed) without refetching
    // the whole chapter document -- wires the already-existing GetResourcesByOwnerAsync (used
    // internally by every *DocumentAsync response) to its own route.
    [HttpGet("resources")]
    public async Task<ActionResult<IReadOnlyList<ResourceDto>>> GetResources(string courseId, [FromQuery] ContentOwnerType ownerType, [FromQuery] string ownerId, CancellationToken cancellationToken)
    {
        var resources = await contentService.GetResourcesByOwnerAsync(courseId, ownerType, ownerId, cancellationToken);
        return Ok(resources);
    }

    [HttpPost("resources")]
    [RequestSizeLimit(ContentService.MaxResourceContentLength + 1024 * 1024)]
    public async Task<ActionResult<ResourceDto>> UploadResource(
        string courseId,
        [FromForm] ContentOwnerType ownerType,
        [FromForm] string ownerId,
        [FromForm] string label,
        [FromForm] string? caption,
        [FromForm] string? role,
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file is null)
            return BadRequest("A file is required.");

        await using var stream = file.OpenReadStream();
        var resource = await contentService.UploadResourceAsync(
            courseId, ownerType, ownerId, label, caption, role, stream, file.FileName, file.ContentType, file.Length, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, resource);
    }

    [HttpPost("resources/attach-existing")]
    public async Task<ActionResult<ResourceDto>> AttachExistingFileAsResource(string courseId, AttachExistingFileAsResourceRequest request, CancellationToken cancellationToken)
    {
        var resource = await contentService.AttachExistingFileAsResourceAsync(courseId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, resource);
    }

    [HttpPut("resources/{resourceId}")]
    public async Task<ActionResult<ResourceDto>> UpdateResource(string courseId, string resourceId, UpdateResourceRequest request, CancellationToken cancellationToken)
    {
        var resource = await contentService.UpdateResourceAsync(courseId, resourceId, request, cancellationToken);
        return Ok(resource);
    }

    [HttpPut("resources/{resourceId}/reorder")]
    public async Task<IActionResult> ReorderResource(string courseId, string resourceId, ReorderRequest request, CancellationToken cancellationToken)
    {
        await contentService.ReorderResourceAsync(courseId, resourceId, request.Direction, cancellationToken);
        return NoContent();
    }

    // Story 8.3: forceRemoveFromContent is a query param (not a route segment) -- this is still
    // one action/one route, matching the story's own "or a query-parameter variant of the same
    // endpoint" allowance, rather than a second overload endpoint.
    [HttpDelete("resources/{resourceId}")]
    public async Task<IActionResult> DeleteResource(string courseId, string resourceId, [FromQuery] bool forceRemoveFromContent, CancellationToken cancellationToken)
    {
        await contentService.DeleteResourceAsync(courseId, resourceId, forceRemoveFromContent, cancellationToken);
        return NoContent();
    }

    // Story 8.3, AD-29: the binary-serving endpoint -- mirrors CourseFilesController.DownloadFile
    // exactly (a standard authenticated stream response, Bearer-token auth via the normal
    // Authorization header). No [Authorize] attribute here either, consistent with every other
    // action on this controller -- ContentService's own EnsureReadableAsync call is the real gate
    // (Story 11.3, AD-29: grants the owning tutor at any LifecycleState, or a Master/Support
    // reviewer once the course is InReview/ReviewConfirmed/Published).
    [HttpGet("resources/{resourceId}/content")]
    public async Task<IActionResult> GetResourceContent(string courseId, string resourceId, CancellationToken cancellationToken)
    {
        var download = await contentService.GetResourceContentAsync(courseId, resourceId, cancellationToken);
        return File(download.Content, download.ContentType, download.FileName);
    }
}
