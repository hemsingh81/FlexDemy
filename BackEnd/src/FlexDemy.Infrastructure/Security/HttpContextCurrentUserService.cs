using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlexDemy.Application.Common;
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
}
