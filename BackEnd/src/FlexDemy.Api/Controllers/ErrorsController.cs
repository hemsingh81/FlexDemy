using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. AD-24: Master-only (AC #1) via a class-level policy, mirroring
// AiConfigController's exact shape -- every action inherits it, no per-action attribute needed.
// Story 4.6 adds the lifecycle write actions; Story 4.7 adds the correlation-trace filter.
[ApiController]
[Route("api/v1/errors")]
[Authorize(Policy = FeatureKeys.ErrorsManage)]
public class ErrorsController(IErrorAdminService errorAdminService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ErrorRecordSummaryDto>>> GetList([FromQuery] ErrorListQuery query, CancellationToken cancellationToken)
    {
        var result = await errorAdminService.GetListAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ErrorRecordDetailDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var result = await errorAdminService.GetByIdAsync(id, cancellationToken);
        return Ok(result);
    }

    // AC #1
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(string id, CancellationToken cancellationToken)
    {
        await errorAdminService.ArchiveAsync(id, cancellationToken);
        return NoContent();
    }

    // AC #2: the acting admin's id comes from ICurrentUserService -- this action requires
    // [Authorize(Policy = FeatureKeys.ErrorsManage)] (class-level), so a valid authenticated
    // caller with a resolvable UserId is a precondition already enforced before this action body
    // ever runs; the same abstraction Story 4.3's own code review established for this exact
    // purpose (not an ad hoc ClaimTypes.NameIdentifier lookup here).
    [HttpPost("{id}/resolve")]
    public async Task<IActionResult> Resolve(string id, CancellationToken cancellationToken)
    {
        await errorAdminService.ResolveAsync(id, currentUserService.UserId!, cancellationToken);
        return NoContent();
    }

    // AC #4: the service throws ValidationException at P0 -- ExceptionHandlingMiddleware maps
    // that to 400, same as every other AppException subtype.
    [HttpPost("{id}/increase-priority")]
    public async Task<IActionResult> IncreasePriority(string id, CancellationToken cancellationToken)
    {
        await errorAdminService.IncreasePriorityAsync(id, currentUserService.UserId!, cancellationToken);
        return NoContent();
    }

    // Permanent hard delete -- unlike Archive/Resolve, there's no undo. The frontend confirms
    // before calling this; [Authorize(Policy = FeatureKeys.ErrorsManage)] (class-level, Master
    // only per AC #1) is the only backend gate, same as every other action on this controller.
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await errorAdminService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    // AC #5
    [HttpGet("retention-settings")]
    public async Task<ActionResult<ErrorRetentionSettingsDto>> GetRetentionSettings(CancellationToken cancellationToken)
    {
        var result = await errorAdminService.GetRetentionSettingsAsync(cancellationToken);
        return Ok(result);
    }

    [HttpPut("retention-settings")]
    public async Task<ActionResult<ErrorRetentionSettingsDto>> UpdateRetentionSettings(UpdateRetentionSettingsRequest request, CancellationToken cancellationToken)
    {
        var result = await errorAdminService.UpdateRetentionSettingsAsync(request.RetentionDays, cancellationToken);
        return Ok(result);
    }
}
