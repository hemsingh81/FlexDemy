using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. Same admin surface/policy as AiConfigController -- this is the same
// AI-config-and-usage screen (Story 1.1/1.2), not a new permission scope.
[ApiController]
[Route("api/v1/ai-usage")]
[Authorize(Policy = FeatureKeys.AiConfigManage)]
public class AiUsageController(IAiUsageService aiUsageService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AiUsageEntryDto>>> GetUsage(string range, CancellationToken cancellationToken)
    {
        var entries = await aiUsageService.GetUsageAsync(range, cancellationToken);
        return Ok(entries);
    }
}
