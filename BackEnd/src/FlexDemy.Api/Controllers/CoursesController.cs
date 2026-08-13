using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/courses")]
public class CoursesController(ICourseService courseService, IPublishService publishService, IVersionService versionService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CourseDto>>> GetCourses(
        [FromQuery] string? gradeTag,
        [FromQuery] string? search,
        [FromQuery] string? subject,
        CancellationToken cancellationToken)
    {
        var courses = await courseService.GetCoursesAsync(gradeTag, search, subject, cancellationToken);
        return Ok(courses);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CourseDto>> GetCourseById(string id, CancellationToken cancellationToken)
    {
        var course = await courseService.GetCourseByIdAsync(id, cancellationToken);
        return Ok(course);
    }

    // Policy-based auth (plan §3, Phase 4 proof point): backed by the FeatureKeys.CoursesCreate
    // row in the role-permission matrix (default: Master, Tutor), enforced dynamically by
    // FeatureAuthorizationHandler rather than a hardcoded Roles list.
    [HttpPost]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> CreateCourse(CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.CreateCourseAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }

    // Story 2.4: the Course Wizard's live-wire persistence surface. All 6 actions below reuse
    // the existing CoursesCreate policy (Master + Tutor) rather than adding a new FeatureKey.
    [HttpPost("drafts")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> CreateDraftCourse(CreateDraftCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.CreateDraftCourseAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }

    [HttpPut("drafts/{id}")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> UpdateDraftCourse(string id, UpdateDraftCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.UpdateDraftCourseAsync(id, request, cancellationToken);
        return Ok(course);
    }

    // First multipart/file-upload endpoint in this codebase -- 4 separate [FromForm]
    // parameters (not a single bound request record), simplest with nothing else to mirror.
    // Code-review patch: without an explicit limit, Kestrel's own default (much larger than
    // this app's 5MB content-length check in CourseService) lets an oversized multipart body be
    // fully read into memory before the application-level rejection ever runs.
    [HttpPost("drafts/{id}/thumbnails")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<CourseDto>> AddThumbnail(
        string id,
        [FromForm] IFormFile file,
        [FromForm] decimal cropX,
        [FromForm] decimal cropY,
        [FromForm] decimal cropZoom,
        CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var course = await courseService.AddThumbnailAsync(
            id, stream, file.ContentType, file.Length, new ThumbnailCropDto(cropX, cropY, cropZoom), cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }

    [HttpDelete("drafts/{id}/thumbnails/{thumbnailId}")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> RemoveThumbnail(string id, string thumbnailId, CancellationToken cancellationToken)
    {
        var course = await courseService.RemoveThumbnailAsync(id, thumbnailId, cancellationToken);
        return Ok(course);
    }

    public record ReorderThumbnailRequest(string Direction);

    [HttpPut("drafts/{id}/thumbnails/{thumbnailId}/reorder")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> ReorderThumbnail(string id, string thumbnailId, ReorderThumbnailRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.ReorderThumbnailAsync(id, thumbnailId, request.Direction, cancellationToken);
        return Ok(course);
    }

    [HttpPut("drafts/{id}/thumbnails/{thumbnailId}/primary")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> SetPrimaryThumbnail(string id, string thumbnailId, CancellationToken cancellationToken)
    {
        var course = await courseService.SetPrimaryThumbnailAsync(id, thumbnailId, cancellationToken);
        return Ok(course);
    }

    // Story 3.9/Task 1: the real Draft -> InReview -> ReviewConfirmed transitions, live-wiring
    // Story 3.4's own mock useCourseLifecycle hook. Same CoursesCreate policy as every other
    // authoring action on this controller.
    [HttpPost("drafts/{id}/move-to-review")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> MoveToReview(string id, CancellationToken cancellationToken)
    {
        await courseService.MoveToReviewAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("drafts/{id}/confirm-review")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> ConfirmReview(string id, CancellationToken cancellationToken)
    {
        await courseService.ConfirmReviewAsync(id, cancellationToken);
        return NoContent();
    }

    // Story 3.10/Task 2: Published -> Draft, so a tutor can iterate on a live course. Same
    // CoursesCreate policy as every other authoring action on this controller.
    [HttpPost("drafts/{id}/return-to-draft")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> ReturnToDraft(string id, CancellationToken cancellationToken)
    {
        await courseService.ReturnToDraftAsync(id, cancellationToken);
        return NoContent();
    }

    // Story 3.10/Task 3: tutor-facing version history + rollback. Ownership is enforced inside
    // VersionService itself (EnsureOwnedAsync), not just by this policy -- CoursesCreate alone
    // only proves "some tutor," not "this course's own tutor."
    [HttpGet("drafts/{id}/versions")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<IReadOnlyList<CourseVersionDto>>> GetVersions(string id, CancellationToken cancellationToken)
    {
        var versions = await versionService.GetVersionsAsync(id, cancellationToken);
        return Ok(versions);
    }

    [HttpPost("drafts/{id}/versions/{versionId}/restore")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> RestoreVersion(string id, string versionId, CancellationToken cancellationToken)
    {
        await versionService.RestoreVersionAsync(id, versionId, cancellationToken);
        return NoContent();
    }

    // Story 3.8/Task 5: the real ReviewConfirmed -> Publishing trigger, live-wiring Story 3.4's
    // own mock PublishLifecycleBar. Tutor-facing, same CoursesCreate policy as every other
    // authoring action on this controller.
    [HttpPost("{id}/publish")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> Publish(string id, CancellationToken cancellationToken)
    {
        await publishService.PublishAsync(id, cancellationToken);
        return NoContent();
    }

    // No [Authorize(Policy = ...)] attribute -- same student-facing-read auth-shape decision this
    // epic's AdaptiveLearningController/ExerciseController/KeywordDefinitionController each make
    // (Stories 3.5-3.7); a tutor watching their own course's publish progress reads through the
    // same open endpoint.
    [HttpGet("{id}/publish-status")]
    public async Task<ActionResult<PublishStatusDto>> GetPublishStatus(string id, CancellationToken cancellationToken)
    {
        var status = await publishService.GetStatusAsync(id, cancellationToken);
        return Ok(status);
    }
}
