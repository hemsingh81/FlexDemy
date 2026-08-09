using System.Security.Claims;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/role-permissions")]
[Authorize]
public class RolePermissionsController(IRolePermissionService rolePermissionService) : ControllerBase
{
    // Any authenticated role -- returns the caller's own feature-key -> visible map, read from
    // their Role claim (not baked into the JWT itself, so a permission change is visible on the
    // next fetch rather than waiting out the token's lifetime; plan §3).
    [HttpGet("mine")]
    public async Task<ActionResult<Dictionary<string, bool>>> GetMine(CancellationToken cancellationToken)
    {
        var role = CurrentUserRole();
        var permissions = await rolePermissionService.GetMineAsync(role, cancellationToken);
        return Ok(permissions);
    }

    [HttpGet]
    [Authorize(Policy = FeatureKeys.AdminPermissionsManage)]
    public async Task<ActionResult<IReadOnlyList<RolePermissionRowDto>>> GetMatrix(CancellationToken cancellationToken)
    {
        var matrix = await rolePermissionService.GetMatrixAsync(cancellationToken);
        return Ok(matrix);
    }

    [HttpPut]
    [Authorize(Policy = FeatureKeys.AdminPermissionsManage)]
    public async Task<IActionResult> UpdateMatrix(List<UpdatePermissionRequest> updates, CancellationToken cancellationToken)
    {
        await rolePermissionService.UpdateMatrixAsync(updates, cancellationToken);
        return NoContent();
    }

    private UserRole CurrentUserRole()
    {
        var roleClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? throw new InvalidOperationException("Authenticated request is missing a role claim.");
        return Enum.Parse<UserRole>(roleClaim);
    }
}
