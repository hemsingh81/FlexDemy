using FlexDemy.Application.MasterData.State;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/states")]
[Authorize]
public class StatesController(IStateService stateService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StateDto>>> GetStates(
        [FromQuery] string? parentId,
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var states = await stateService.GetAllAsync(effectiveIncludeInactive, parentId, cancellationToken);
        return Ok(states);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StateDto>> GetStateById(string id, CancellationToken cancellationToken)
    {
        var state = await stateService.GetByIdAsync(id, cancellationToken);
        return Ok(state);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<StateDto>> CreateState(CreateStateRequest request, CancellationToken cancellationToken)
    {
        var state = await stateService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetStateById), new { id = state.Id }, state);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<StateDto>> UpdateState(string id, UpdateStateRequest request, CancellationToken cancellationToken)
    {
        var state = await stateService.UpdateAsync(id, request, cancellationToken);
        return Ok(state);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteState(string id, CancellationToken cancellationToken)
    {
        await stateService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
