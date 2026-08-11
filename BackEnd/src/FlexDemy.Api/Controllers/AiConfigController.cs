using FlexDemy.Application.AiConfig;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
// Both actions are Master-only: the ai-configuration admin sub-tab was already established
// Master-only in Story 1.1, unlike CountriesController's wider-access GET.
[ApiController]
[Route("api/v1/ai-task-configs")]
[Authorize(Policy = FeatureKeys.AiConfigManage)]
public class AiConfigController(IAiConfigService aiConfigService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AiTaskConfigDto>>> GetAllTaskConfigs(CancellationToken cancellationToken)
    {
        var configs = await aiConfigService.GetAllTaskConfigsAsync(cancellationToken);
        return Ok(configs);
    }

    [HttpPut("{taskId}")]
    public async Task<ActionResult<AiTaskConfigDto>> UpdateTaskConfig(string taskId, UpdateAiTaskConfigRequest request, CancellationToken cancellationToken)
    {
        var config = await aiConfigService.UpdateTaskConfigAsync(taskId, request, cancellationToken);
        return Ok(config);
    }
}
