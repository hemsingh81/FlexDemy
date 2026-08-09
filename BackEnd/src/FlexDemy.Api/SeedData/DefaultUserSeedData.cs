using FlexDemy.Domain.Users;

namespace FlexDemy.Api.SeedData;

// Dev-only seed: one default account per role so the RBAC model has something to sign in
// as immediately. See Program.cs's EnsureSeedUserAsync for the idempotent upsert logic that
// consumes this list. Not for production data.
public static class DefaultUserSeedData
{
    public record UserSeed(string Email, string Password, string FirstName, string LastName, UserRole Role);

    public static readonly IReadOnlyList<UserSeed> Users =
    [
        new("hemsingh81@gmail.com", "Password@123", "Hem", "Singh", UserRole.Master),
        new("support@flexdemy.com", "Password@123", "Sam", "Support", UserRole.Support),
        new("tutor@flexdemy.com", "Password@123", "Tara", "Tutor", UserRole.Tutor),
        new("student@flexdemy.com", "Password@123", "Stu", "Student", UserRole.Student),
    ];
}
