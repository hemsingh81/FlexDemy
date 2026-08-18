using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Http;

namespace FlexDemy.Infrastructure.Security;

// Mirrors ProfilesController.CurrentUserId()'s claim lookup: JwtTokenService issues "sub"
// (JwtRegisteredClaimNames.Sub), and whether that surfaces as ClaimTypes.NameIdentifier depends
// on JwtBearerOptions.MapInboundClaims (defaulted, not set explicitly in Program.cs), so both are
// checked. Returns null (rather than throwing) when there's no authenticated HttpContext at all --
// e.g. during Program.cs's startup seeding, where CreatedBy is expected to stay null.
public class HttpContextCurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public string? UserId =>
        httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? httpContextAccessor.HttpContext?.User.FindFirstValue(JwtRegisteredClaimNames.Sub);

    // Story 11.3: same ClaimTypes.Role claim FeatureAuthorizationHandler.cs already reads, just
    // from the Application layer instead of an ASP.NET Core authorization handler -- one claim
    // name, read consistently in both places, not a second convention.
    public UserRole? Role
    {
        get
        {
            var roleClaim = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);
            return roleClaim is not null && Enum.TryParse<UserRole>(roleClaim, out var role) ? role : null;
        }
    }
}
