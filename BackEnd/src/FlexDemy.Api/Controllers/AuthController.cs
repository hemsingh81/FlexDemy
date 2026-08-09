using FlexDemy.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(IUserService userService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await userService.LoginAsync(request, cancellationToken);
        return Ok(user);
    }

    [HttpPost("register")]
    public async Task<ActionResult<UserDto>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var user = await userService.RegisterAsync(request, cancellationToken);
        return Ok(user);
    }
}
