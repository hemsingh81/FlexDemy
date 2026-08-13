using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Course-scoped, not node-scoped -- a keyword isn't tied to one Topic/
// Subtopic the way Drill-Down/Ways/Exercise are. GET has no [Authorize(Policy = ...)] attribute --
// same student-facing auth-shape decision AdaptiveLearningController.cs/ExerciseController.cs
// (Stories 3.5/3.6) make. PUT override is tutor-facing.
[ApiController]
[Route("api/v1/courses/{courseId}/keywords")]
public class KeywordDefinitionController(IKeywordDefinitionService keywordDefinitionService) : ControllerBase
{
    [HttpGet("{keyword}")]
    public async Task<ActionResult<KeywordDefinitionDto>> GetDefinition(string courseId, string keyword, CancellationToken cancellationToken)
    {
        var result = await keywordDefinitionService.DefineAsync(courseId, keyword, cancellationToken);
        return Ok(result);
    }

    public record SetOverrideRequest(string DefinitionText);

    [HttpPut("{keyword}/override")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> SetOverride(string courseId, string keyword, SetOverrideRequest request, CancellationToken cancellationToken)
    {
        await keywordDefinitionService.SetOverrideAsync(courseId, keyword, request.DefinitionText, cancellationToken);
        return NoContent();
    }
}
