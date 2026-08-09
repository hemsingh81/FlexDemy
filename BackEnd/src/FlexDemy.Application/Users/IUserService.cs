using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

// AD-3: plain service interface, no mediator. AD-12: other features (e.g. Profiles) may
// depend on this interface to read/mutate a user's Role, but never on IUserRepository directly.
public interface IUserService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> GetByIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<UserDto> AssignRoleAsync(string userId, UserRole newRole, CancellationToken cancellationToken = default);

    // Admin user-management lists (plan: Support/Tutor account management) -- backs
    // GET /api/v1/admin/users/support and GET /api/v1/admin/users/tutors.
    Task<List<UserDto>> GetUsersByRoleAsync(UserRole role, CancellationToken cancellationToken = default);

    // Activates/deactivates a Support or Tutor account -- backs
    // PUT /api/v1/admin/users/{id}/status. Controller performs the differentiated
    // per-target-role authorization check before calling this.
    Task<UserDto> SetUserActiveStatusAsync(string userId, bool isActive, CancellationToken cancellationToken = default);

    // Master-only (plan §4): provisions a Support account with a system-generated temporary
    // password and MustChangePassword=true.
    Task<CreateSupportUserResponse> CreateSupportUserAsync(CreateSupportUserRequest request, CancellationToken cancellationToken = default);

    // Any authenticated user: verifies CurrentPassword, sets NewPassword, clears MustChangePassword.
    Task<UserDto> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);

    // Master-only today (plan: edit Support user details): updates FirstName/LastName/Email --
    // backs PUT /api/v1/admin/users/{id}/details. Controller performs the differentiated
    // per-target-role authorization check before calling this, same as SetUserActiveStatusAsync.
    Task<UserDto> UpdateUserDetailsAsync(string userId, UpdateUserDetailsRequest request, CancellationToken cancellationToken = default);
}
