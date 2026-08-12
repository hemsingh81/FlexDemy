using System.Text.Json;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Endpoint shape deliberately mirrors useCourseContentTree.ts's own
// polymorphic-by-id mutator set (Task 5) so contentTreeService.ts (Task 9) maps close to 1:1.
// No [RequestSizeLimit] anywhere here -- every request body is small structured JSON (titles,
// ids, short content text), not a file upload; Story 2.6's precedent doesn't apply.
[ApiController]
[Route("api/v1/courses/{courseId}/content-tree")]
[Authorize(Policy = FeatureKeys.CoursesCreate)]
public class ContentTreeController(IContentTreeService contentTreeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ChapterDto>>> GetTree(string courseId, CancellationToken cancellationToken)
    {
        var tree = await contentTreeService.GetTreeAsync(courseId, cancellationToken);
        return Ok(tree);
    }

    [HttpPost("chapters")]
    public async Task<ActionResult<ChapterDto>> AddChapter(string courseId, CancellationToken cancellationToken)
    {
        var chapter = await contentTreeService.AddChapterAsync(courseId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, chapter);
    }

    public record AddTopicRequest(string ChapterId);

    [HttpPost("topics")]
    public async Task<ActionResult<TopicDto>> AddTopic(string courseId, AddTopicRequest request, CancellationToken cancellationToken)
    {
        var topic = await contentTreeService.AddTopicAsync(courseId, request.ChapterId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, topic);
    }

    public record AddSubtopicRequest(string TopicId);

    [HttpPost("subtopics")]
    public async Task<ActionResult<SubtopicDto>> AddSubtopic(string courseId, AddSubtopicRequest request, CancellationToken cancellationToken)
    {
        var subtopic = await contentTreeService.AddSubtopicAsync(courseId, request.TopicId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, subtopic);
    }

    public record AddContentBlockRequest(string ParentId, string ParentType);

    [HttpPost("content-blocks")]
    public async Task<ActionResult<ContentBlockDto>> AddContentBlock(string courseId, AddContentBlockRequest request, CancellationToken cancellationToken)
    {
        var block = await contentTreeService.AddContentBlockAsync(courseId, request.ParentId, request.ParentType, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, block);
    }

    public record EditNodeTitleRequest(string Title);

    [HttpPatch("nodes/{id}/title")]
    public async Task<IActionResult> EditNodeTitle(string courseId, string id, EditNodeTitleRequest request, CancellationToken cancellationToken)
    {
        await contentTreeService.EditNodeTitleAsync(courseId, id, request.Title, cancellationToken);
        return NoContent();
    }

    // A plain nullable-field request DTO can't distinguish "field omitted" from "field explicitly
    // set to null" -- bound as JsonElement instead so TouchedFields can be built from which of the
    // six known property names the caller's JSON body actually included (see ContentTreeDtos.cs).
    private static readonly string[] PatchableContentBlockFields = ["text", "lang", "notation", "imageUrl", "altText", "format"];

    [HttpPatch("content-blocks/{id}")]
    public async Task<IActionResult> EditContentBlock(string courseId, string id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var touched = new HashSet<string>();
        string? Get(string field)
        {
            if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(field, out var value))
                return null;
            touched.Add(field);
            // Code-review patch: GetString() throws InvalidOperationException (an unhandled 500,
            // since ExceptionHandlingMiddleware only translates AppException) for any non-string,
            // non-null JSON value, e.g. {"text": 123} -- a clean 400 is the correct response for a
            // malformed request body, not a raw server error.
            if (value.ValueKind == JsonValueKind.Null)
                return null;
            if (value.ValueKind != JsonValueKind.String)
                throw new ValidationException($"'{field}' must be a string or null.");
            return value.GetString();
        }

        var fields = PatchableContentBlockFields.ToDictionary(f => f, Get);
        var patch = new UpdateContentBlockRequest(
            fields["text"], fields["lang"], fields["notation"], fields["imageUrl"], fields["altText"], fields["format"],
            touched);

        await contentTreeService.EditContentBlockAsync(courseId, id, patch, cancellationToken);
        return NoContent();
    }

    [HttpDelete("nodes/{id}")]
    public async Task<IActionResult> DeleteNode(string courseId, string id, CancellationToken cancellationToken)
    {
        await contentTreeService.DeleteNodeAsync(courseId, id, cancellationToken);
        return NoContent();
    }

    public record ReorderNodeRequest(string Direction);

    [HttpPost("nodes/{id}/reorder")]
    public async Task<IActionResult> ReorderNode(string courseId, string id, ReorderNodeRequest request, CancellationToken cancellationToken)
    {
        await contentTreeService.ReorderNodeAsync(courseId, id, request.Direction, cancellationToken);
        return NoContent();
    }

    public record MoveNodeRequest(string TargetId);

    [HttpPost("nodes/{id}/move")]
    public async Task<IActionResult> MoveNode(string courseId, string id, MoveNodeRequest request, CancellationToken cancellationToken)
    {
        await contentTreeService.MoveNodeAsync(courseId, id, request.TargetId, cancellationToken);
        return NoContent();
    }

    [HttpPost("nodes/{id}/confirm")]
    public async Task<IActionResult> ConfirmNode(string courseId, string id, CancellationToken cancellationToken)
    {
        await contentTreeService.ConfirmNodeAsync(courseId, id, cancellationToken);
        return NoContent();
    }
}
