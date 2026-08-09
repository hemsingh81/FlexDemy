using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Uses EF Core's InMemory provider -- fast, no Docker dependency for unit tests (mirrors
// CourseRepositoryTests).
public class UserRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static User MakeUser(string id, string email, UserRole role) => new()
    {
        Id = id,
        Email = email,
        PasswordHash = "hashed",
        FirstName = "First",
        LastName = "Last",
        Role = role,
    };

    [Fact]
    public async Task GetByRoleAsync_returns_only_users_with_the_matching_role()
    {
        await using var db = NewContext();
        db.Users.AddRange(
            MakeUser("usr_1", "support1@x.com", UserRole.Support),
            MakeUser("usr_2", "support2@x.com", UserRole.Support),
            MakeUser("usr_3", "tutor1@x.com", UserRole.Tutor),
            MakeUser("usr_4", "student1@x.com", UserRole.Student));
        await db.SaveChangesAsync();
        var repository = new UserRepository(db);

        var supportUsers = await repository.GetByRoleAsync(UserRole.Support);

        Assert.Equal(["usr_1", "usr_2"], supportUsers.Select(u => u.Id).Order());
    }

    [Fact]
    public async Task GetByRoleAsync_returns_empty_list_when_no_users_have_that_role()
    {
        await using var db = NewContext();
        db.Users.Add(MakeUser("usr_1", "student1@x.com", UserRole.Student));
        await db.SaveChangesAsync();
        var repository = new UserRepository(db);

        var tutors = await repository.GetByRoleAsync(UserRole.Tutor);

        Assert.Empty(tutors);
    }
}
