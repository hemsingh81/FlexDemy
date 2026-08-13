using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Student-facing GET reads have no [Authorize(Policy = ...)] attribute --
// matches CoursesController.GetCourseById's own convention (any authenticated user, not
// tutor-gated). Tutor-facing PUT override writes use FeatureKeys.CoursesCreate, matching every
// other tutor-authoring endpoint in this codebase (ContentTreeController, CoursesController's
// draft/thumbnail actions).
[ApiController]
[Route("api/v1/courses/{courseId}/adaptive-learning")]
public class AdaptiveLearningController(IAdaptiveLearningService adaptiveLearningService) : ControllerBase
{
    [HttpGet("nodes/{nodeId}/drilldown/{level:int}")]
    public async Task<ActionResult<DrilldownLevelDto>> GetDrilldownLevel(string courseId, string nodeId, int level, CancellationToken cancellationToken)
    {
        var result = await adaptiveLearningService.GetOrGenerateLevelAsync(courseId, nodeId, level, cancellationToken);
        return Ok(result);
    }

    [HttpGet("nodes/{nodeId}/ways/{wayNumber:int}")]
    public async Task<ActionResult<WayContentDto>> GetWay(string courseId, string nodeId, int wayNumber, CancellationToken cancellationToken)
    {
        var result = await adaptiveLearningService.GetOrGenerateWayAsync(courseId, nodeId, wayNumber, cancellationToken);
        return Ok(result);
    }

    public record ExampleItemRequest(
        string Id, string Title, string Problem, IReadOnlyList<string> StepByStepSolution, string FinalAnswer, string Difficulty);

    public record SetLevelOverrideRequest(
        string Title,
        string Subtitle,
        string Content,
        IReadOnlyList<string> KeyPoints,
        IReadOnlyList<string>? MathFormulas,
        IReadOnlyList<ExampleItemRequest> Examples);

    public record SetWayOverrideRequest(string Explanation, ExampleItemRequest Example);

    [HttpPut("nodes/{nodeId}/drilldown/{level:int}/override")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> SetLevelOverride(string courseId, string nodeId, int level, SetLevelOverrideRequest request, CancellationToken cancellationToken)
    {
        var content = new DrilldownLevelContent(
            request.Title, request.Subtitle, request.Content, request.KeyPoints, request.MathFormulas,
            request.Examples.Select(ToContent).ToList());

        await adaptiveLearningService.SetLevelOverrideAsync(courseId, nodeId, level, content, cancellationToken);
        return NoContent();
    }

    [HttpPut("nodes/{nodeId}/ways/{wayNumber:int}/override")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> SetWayOverride(string courseId, string nodeId, int wayNumber, SetWayOverrideRequest request, CancellationToken cancellationToken)
    {
        var content = new WayContentData(request.Explanation, ToContent(request.Example));

        await adaptiveLearningService.SetWayOverrideAsync(courseId, nodeId, wayNumber, content, cancellationToken);
        return NoContent();
    }

    private static ExampleItemContent ToContent(ExampleItemRequest request) =>
        new(request.Id, request.Title, request.Problem, request.StepByStepSolution, request.FinalAnswer, request.Difficulty);
}
