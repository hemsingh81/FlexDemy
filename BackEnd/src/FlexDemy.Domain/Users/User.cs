namespace FlexDemy.Domain.Users;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4). Identifier is email or phone,
// stored in Email -- matches the frontend's "Email or Phone Number" single-field login.
public class User
{
    public required string Id { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
