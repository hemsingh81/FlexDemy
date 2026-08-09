namespace FlexDemy.Application.Users;

public interface IUserService
{
    Task<UserDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
}
