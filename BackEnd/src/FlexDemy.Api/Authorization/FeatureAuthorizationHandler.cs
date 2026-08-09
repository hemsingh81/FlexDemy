using System.Security.Claims;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;

namespace FlexDemy.Api.Authorization;

// The lock-out safety net the whole dynamic role-permission system depends on (plan §3): a
// fat-fingered permission-matrix change can never lock Master out, because Master's Role claim
// alone is enough to succeed -- checked first, unconditionally, before any DB/cache lookup.
public class FeatureAuthorizationHandler(IRolePermissionCache cache) : AuthorizationHandler<FeatureRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, FeatureRequirement requirement)
    {
        var roleClaim = context.User.FindFirstValue(ClaimTypes.Role);

        if (roleClaim == nameof(UserRole.Master))
        {
            context.Succeed(requirement);
            return;
        }

        if (roleClaim is not null
            && Enum.TryParse<UserRole>(roleClaim, out var role)
            && await cache.IsVisibleAsync(role, requirement.FeatureKey))
        {
            context.Succeed(requirement);
        }

        // No explicit context.Fail() here: leaving the requirement unsatisfied is the standard
        // ASP.NET Core authorization handler pattern for "this handler doesn't grant access" --
        // Fail() is reserved for short-circuiting every other handler, which isn't needed here.
    }
}
