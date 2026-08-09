using FlexDemy.Application.Permissions;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call per action
// (SetUserActiveStatus's authorization check is the one deliberate exception, see below).
// Policy-based auth (plan §3, Phase 4), applied per-action rather than at the class level: a
// class-level [Authorize] combines (ANDs) with any action-level [Authorize], so each action
// here declares its own policy directly instead of relying on a shared class attribute.
[ApiController]
[Route("api/v1/admin/users")]
public class AdminUsersController(IUserService userService, IAuthorizationService authorizationService) : ControllerBase
{
    // Master-only: backed by the FeatureKeys.AdminUsersCreate row in the role-permission
    // matrix (default: Master only).
    [HttpPost("support")]
    [Authorize(Policy = FeatureKeys.AdminUsersCreate)]
    public async Task<ActionResult<CreateSupportUserResponse>> CreateSupportUser(CreateSupportUserRequest request, CancellationToken cancellationToken)
    {
        var response = await userService.CreateSupportUserAsync(request, cancellationToken);
        return Ok(response);
    }

    // Master-only, same policy as creating a Support user.
    [HttpGet("support")]
    [Authorize(Policy = FeatureKeys.AdminUsersCreate)]
    public async Task<ActionResult<List<UserDto>>> ListSupportUsers(CancellationToken cancellationToken)
    {
        var users = await userService.GetUsersByRoleAsync(UserRole.Support, cancellationToken);
        return Ok(users);
    }

    // Master+Support: matches who already reviews tutors (ProfilesController's
    // tutor-applications endpoints use the same policy).
    [HttpGet("tutors")]
    [Authorize(Policy = FeatureKeys.TutorApprove)]
    public async Task<ActionResult<List<UserDto>>> ListTutorUsers(CancellationToken cancellationToken)
    {
        var users = await userService.GetUsersByRoleAsync(UserRole.Tutor, cancellationToken);
        return Ok(users);
    }

    // Shared by both Support and Tutor account activation/deactivation, which have different
    // authorized policies (Support management is Master-only; Tutor management is
    // Master+Support). A single [Authorize(Policy=...)] can't express "either policy" cleanly,
    // so this action is gated with a bare [Authorize] (any authenticated role) and does the
    // real, differentiated authorization manually below: load the target user first, then
    // require the caller to satisfy the policy that matches the TARGET's role, not the
    // caller's. Any target role other than Support/Tutor is rejected outright -- this endpoint
    // is only for Support/Tutor account management.
    [HttpPut("{id}/status")]
    [Authorize]
    public async Task<ActionResult<UserDto>> SetUserActiveStatus(string id, SetUserActiveStatusRequest request, CancellationToken cancellationToken)
    {
        var target = await userService.GetByIdAsync(id, cancellationToken);

        var requiredPolicy = target.Role switch
        {
            nameof(UserRole.Support) => FeatureKeys.AdminUsersCreate,
            nameof(UserRole.Tutor) => FeatureKeys.TutorApprove,
            _ => null,
        };
        if (requiredPolicy is null)
            return Forbid();

        var authorization = await authorizationService.AuthorizeAsync(User, requiredPolicy);
        if (!authorization.Succeeded)
            return Forbid();

        var updated = await userService.SetUserActiveStatusAsync(id, request.IsActive, cancellationToken);
        return Ok(updated);
    }

    // Edits a Support user's FirstName/LastName/Email. Same shape as SetUserActiveStatus above:
    // a bare [Authorize] plus a manual, target-role-keyed authorization check, because the
    // policy that applies depends on the TARGET's role, not the caller's. Only Support targets
    // are supported today -- any other target role (including Tutor) is rejected outright, same
    // defensive Forbid() as the /status action, ready to extend the switch if Tutor editing is
    // ever scoped through this endpoint.
    [HttpPut("{id}/details")]
    [Authorize]
    public async Task<ActionResult<UserDto>> UpdateUserDetails(string id, UpdateUserDetailsRequest request, CancellationToken cancellationToken)
    {
        var target = await userService.GetByIdAsync(id, cancellationToken);

        var requiredPolicy = target.Role switch
        {
            nameof(UserRole.Support) => FeatureKeys.AdminUsersCreate,
            _ => null,
        };
        if (requiredPolicy is null)
            return Forbid();

        var authorization = await authorizationService.AuthorizeAsync(User, requiredPolicy);
        if (!authorization.Succeeded)
            return Forbid();

        var updated = await userService.UpdateUserDetailsAsync(id, request, cancellationToken);
        return Ok(updated);
    }
}
