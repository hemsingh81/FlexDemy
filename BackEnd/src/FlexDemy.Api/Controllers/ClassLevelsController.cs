using FlexDemy.Application.MasterData.ClassLevel;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/class-levels")]
[Authorize]
public class ClassLevelsController(IClassLevelService classLevelService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClassLevelDto>>> GetClassLevels(
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var classLevels = await classLevelService.GetAllAsync(effectiveIncludeInactive, cancellationToken);
        return Ok(classLevels);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ClassLevelDto>> GetClassLevelById(string id, CancellationToken cancellationToken)
    {
        var classLevel = await classLevelService.GetByIdAsync(id, cancellationToken);
        return Ok(classLevel);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<ClassLevelDto>> CreateClassLevel(CreateClassLevelRequest request, CancellationToken cancellationToken)
    {
        var classLevel = await classLevelService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetClassLevelById), new { id = classLevel.Id }, classLevel);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<ClassLevelDto>> UpdateClassLevel(string id, UpdateClassLevelRequest request, CancellationToken cancellationToken)
    {
        var classLevel = await classLevelService.UpdateAsync(id, request, cancellationToken);
        return Ok(classLevel);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteClassLevel(string id, CancellationToken cancellationToken)
    {
        await classLevelService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
