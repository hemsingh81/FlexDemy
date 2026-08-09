namespace FlexDemy.Application.Users;

public record UserDto(string Id, string Email, string FirstName, string LastName, string Role, bool IsActive);

// Bundles the profile with the bearer token the frontend sends back as
// Authorization: Bearer <Token> on subsequent requests (e.g. POST /api/v1/courses).
// MustChangePassword lets the frontend force the change-password screen for
// Master/Support-provisioned accounts still on their system-generated temp password (plan §4).
public record AuthResponse(UserDto User, string Token, bool MustChangePassword);

// Identifier accepts email or phone number (mirrors the frontend's single-field login).
public record LoginRequest(string Identifier, string Password);

public record RegisterRequest(string FirstName, string LastName, string Identifier, string Password);

// Master-only (plan §4): creates a Support account with a system-generated temporary
// password. Identifier accepts email or phone, same as RegisterRequest/LoginRequest.
public record CreateSupportUserRequest(string FirstName, string LastName, string Identifier);

// TemporaryPassword is the plaintext -- this response is the only place it's ever visible;
// Master relays it out-of-band. It is never stored or logged.
public record CreateSupportUserResponse(UserDto User, string TemporaryPassword);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

// Used by PUT /api/v1/admin/users/{id}/status to activate/deactivate a Support or Tutor account.
public record SetUserActiveStatusRequest(bool IsActive);

// Used by PUT /api/v1/admin/users/{id}/details to edit a Support user's profile fields.
// Email doubles as the login identifier (User.cs) -- changing it changes what the user logs
// in with going forward, which is expected/intended for an admin edit.
public record UpdateUserDetailsRequest(string FirstName, string LastName, string Email);
