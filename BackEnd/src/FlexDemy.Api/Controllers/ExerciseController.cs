using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Student-facing GET/POST submit have no [Authorize(Policy = ...)]
// attribute -- same auth-shape decision AdaptiveLearningController.cs (Story 3.5) makes, matched
// exactly here rather than re-deciding independently. Tutor-facing propose/save/delete use
// FeatureKeys.CoursesCreate.
[ApiController]
[Route("api/v1/courses/{courseId}/adaptive-learning/nodes/{nodeId}/exercise")]
public class ExerciseController(IExerciseService exerciseService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ExerciseDto?>> GetExercise(string courseId, string nodeId, CancellationToken cancellationToken)
    {
        var result = await exerciseService.GetExerciseAsync(courseId, nodeId, cancellationToken);
        return Ok(result);
    }

    public record ProposeExerciseRequest(string AnswerType);

    [HttpPost("propose")]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<ExerciseDraftDto>> ProposeExercise(string courseId, string nodeId, ProposeExerciseRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<AnswerType>(request.AnswerType, ignoreCase: true, out var answerType))
            throw new ValidationException($"Invalid answer type '{request.AnswerType}'.");

        var result = await exerciseService.ProposeExerciseAsync(courseId, nodeId, answerType, cancellationToken);
        return Ok(result);
    }

    [HttpPut]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<ExerciseDto>> SaveExercise(string courseId, string nodeId, SaveExerciseRequest request, CancellationToken cancellationToken)
    {
        var result = await exerciseService.SaveExerciseAsync(courseId, nodeId, request, cancellationToken);
        return Ok(result);
    }

    [HttpDelete]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<IActionResult> DeleteExercise(string courseId, string nodeId, CancellationToken cancellationToken)
    {
        await exerciseService.DeleteExerciseAsync(courseId, nodeId, cancellationToken);
        return NoContent();
    }

    public record SubmitAnswerRequest(string Answer);

    [HttpPost("submit")]
    public async Task<ActionResult<ExerciseSubmissionResultDto>> SubmitAnswer(string courseId, string nodeId, SubmitAnswerRequest request, CancellationToken cancellationToken)
    {
        var result = await exerciseService.SubmitAnswerAsync(courseId, nodeId, request.Answer, cancellationToken);
        return Ok(result);
    }
}
