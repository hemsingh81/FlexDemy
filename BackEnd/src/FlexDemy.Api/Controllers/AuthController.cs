using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlexDemy.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(IUserService userService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await userService.LoginAsync(request, cancellationToken);
        return Ok(response);
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var response = await userService.RegisterAsync(request, cancellationToken);
        return Ok(response);
    }

    // Any authenticated role: lets the frontend validate a persisted token and rehydrate the
    // current user on page load/refresh. An invalid/expired token never reaches the action body
    // -- [Authorize] + the JWT bearer handler short-circuit to a clean 401 first.
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var user = await userService.GetByIdAsync(CurrentUserId(), cancellationToken);
        return Ok(user);
    }

    // Any authenticated user (self-service); mirrors Master/Support-provisioned accounts
    // forced through this on first login via MustChangePassword (plan §4).
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<UserDto>> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await userService.ChangePasswordAsync(CurrentUserId(), request, cancellationToken);
        return Ok(user);
    }

    // JwtTokenService issues "sub"; whether it surfaces as ClaimTypes.NameIdentifier depends
    // on JwtBearerOptions.MapInboundClaims (defaulted, not set explicitly in Program.cs), so
    // both are checked rather than relying on that default (mirrors ProfilesController).
    private string CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new InvalidOperationException("Authenticated request is missing a user id claim.");
}
