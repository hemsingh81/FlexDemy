using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Users;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4). Identifier is email or phone,
// stored in Email -- matches the frontend's "Email or Phone Number" single-field login.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class User : AuditableEntity
{
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public UserRole Role { get; set; } = UserRole.Student;

    // Set true when Master/Support creates the account with a system-generated temporary
    // password (plan §4); cleared by UserService.ChangePasswordAsync once the user sets
    // their own password. Never true for self-registered accounts.
    public bool MustChangePassword { get; set; } = false;
}
