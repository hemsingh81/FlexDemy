namespace FlexDemy.Application.Users;

public record UserDto(string Id, string Email, string FirstName, string LastName);

// Identifier accepts email or phone number (mirrors the frontend's single-field login).
public record LoginRequest(string Identifier, string Password);

public record RegisterRequest(string FirstName, string LastName, string Identifier, string Password);
