using FlexDemy.Application.Common;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Users;

public class UserServiceTests
{
    private static User MakeUser(string email = "hemsingh81@gmail.com", string hash = "hashed", UserRole role = UserRole.Master, bool isActive = true) => new()
    {
        Id = "usr_1",
        Email = email,
        PasswordHash = hash,
        FirstName = "Hem",
        LastName = "Singh",
        Role = role,
        IsActive = isActive,
    };

    private static ITokenService FakeTokenService()
    {
        var tokenService = Substitute.For<ITokenService>();
        tokenService.GenerateToken(Arg.Any<User>()).Returns("fake-jwt");
        return tokenService;
    }

    [Fact]
    public async Task LoginAsync_returns_the_user_and_a_token_when_password_matches()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        hasher.Verify("Password@123", "hashed").Returns(true);
        var sut = new UserService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher, FakeTokenService());

        var result = await sut.LoginAsync(new LoginRequest("hemsingh81@gmail.com", "Password@123"));

        Assert.Equal("hemsingh81@gmail.com", result.User.Email);
        Assert.Equal("Master", result.User.Role);
        Assert.Equal("fake-jwt", result.Token);
    }

    [Fact]
    public async Task LoginAsync_throws_Unauthorized_when_user_missing_or_password_wrong()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("missing@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher, FakeTokenService());

        await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.LoginAsync(new LoginRequest("missing@x.com", "whatever")));

        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        hasher.Verify("wrong", "hashed").Returns(false);
        await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.LoginAsync(new LoginRequest("hemsingh81@gmail.com", "wrong")));
    }

    [Fact]
    public async Task LoginAsync_throws_Unauthorized_when_account_is_deactivated()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser(isActive: false));
        hasher.Verify("Password@123", "hashed").Returns(true);
        var sut = new UserService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher, FakeTokenService());

        var ex = await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.LoginAsync(new LoginRequest("hemsingh81@gmail.com", "Password@123")));
        Assert.Contains("deactivated", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RegisterAsync_hashes_password_assigns_id_defaults_to_Unassigned_and_commits_once()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("new@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        idGenerator.NewId().Returns("usr_new");
        hasher.Hash("Password@123").Returns("hashed_new");
        var sut = new UserService(repository, unitOfWork, idGenerator, hasher, FakeTokenService());

        var result = await sut.RegisterAsync(new RegisterRequest("Hem", "Singh", "new@x.com", "Password@123"));

        Assert.Equal("usr_new", result.User.Id);
        Assert.Equal("Unassigned", result.User.Role);
        repository.Received(1).Add(Arg.Is<User>(u => u.PasswordHash == "hashed_new" && u.Email == "new@x.com" && u.Role == UserRole.Unassigned));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RegisterAsync_throws_Conflict_when_identifier_already_registered()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<ConflictException>(
            () => sut.RegisterAsync(new RegisterRequest("Hem", "Singh", "hemsingh81@gmail.com", "Password@123")));
    }

    [Fact]
    public async Task GetByIdAsync_returns_the_user_when_found()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(MakeUser());
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.GetByIdAsync("usr_1");

        Assert.Equal("usr_1", result.Id);
        Assert.Equal("Master", result.Role);
    }

    [Fact]
    public async Task GetByIdAsync_throws_NotFound_when_user_missing()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.GetByIdAsync("missing"));
    }

    [Fact]
    public async Task AssignRoleAsync_updates_the_role_and_commits_once()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Unassigned);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.AssignRoleAsync("usr_1", UserRole.Student);

        Assert.Equal("Student", result.Role);
        Assert.Equal(UserRole.Student, user.Role);
        repository.Received(1).Update(Arg.Is<User>(u => u.Role == UserRole.Student));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AssignRoleAsync_throws_NotFound_when_user_missing()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.AssignRoleAsync("missing", UserRole.Student));
    }

    [Fact]
    public async Task CreateSupportUserAsync_creates_a_Support_user_with_MustChangePassword_and_returns_a_verifiable_temp_password()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var hasher = new RoundTrippingPasswordHasherFake();
        repository.GetByEmailAsync("support@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        idGenerator.NewId().Returns("usr_support");
        User? added = null;
        repository.Add(Arg.Do<User>(u => added = u));
        var sut = new UserService(repository, unitOfWork, idGenerator, hasher, FakeTokenService());

        var result = await sut.CreateSupportUserAsync(new CreateSupportUserRequest("Sam", "Support", "support@x.com"));

        Assert.Equal("usr_support", result.User.Id);
        Assert.Equal("Support", result.User.Role);
        Assert.False(string.IsNullOrEmpty(result.TemporaryPassword));

        Assert.NotNull(added);
        Assert.Equal(UserRole.Support, added!.Role);
        Assert.True(added.MustChangePassword);
        // The returned plaintext must actually verify against the stored hash.
        Assert.True(hasher.Verify(result.TemporaryPassword, added.PasswordHash));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSupportUserAsync_throws_Conflict_when_identifier_already_registered()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<ConflictException>(
            () => sut.CreateSupportUserAsync(new CreateSupportUserRequest("Sam", "Support", "hemsingh81@gmail.com")));
    }

    [Fact]
    public async Task ChangePasswordAsync_verifies_current_password_rehashes_and_clears_MustChangePassword()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var hasher = Substitute.For<IPasswordHasher>();
        var user = MakeUser();
        user.MustChangePassword = true;
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        hasher.Verify("OldPass@1", "hashed").Returns(true);
        hasher.Hash("NewPass@1").Returns("hashed_new");
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), hasher, FakeTokenService());

        var result = await sut.ChangePasswordAsync("usr_1", new ChangePasswordRequest("OldPass@1", "NewPass@1"));

        Assert.Equal("usr_1", result.Id);
        Assert.Equal("hashed_new", user.PasswordHash);
        Assert.False(user.MustChangePassword);
        repository.Received(1).Update(Arg.Is<User>(u => u.PasswordHash == "hashed_new" && !u.MustChangePassword));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ChangePasswordAsync_throws_Unauthorized_when_current_password_is_wrong()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        var user = MakeUser();
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        hasher.Verify("wrong", "hashed").Returns(false);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher, FakeTokenService());

        await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.ChangePasswordAsync("usr_1", new ChangePasswordRequest("wrong", "NewPass@1")));
    }

    [Fact]
    public async Task GetUsersByRoleAsync_returns_only_users_the_repository_maps_for_that_role()
    {
        var repository = Substitute.For<IUserRepository>();
        var supportUsers = new List<User>
        {
            MakeUser(email: "s1@x.com", role: UserRole.Support),
            MakeUser(email: "s2@x.com", role: UserRole.Support),
        };
        repository.GetByRoleAsync(UserRole.Support, Arg.Any<CancellationToken>()).Returns(supportUsers);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.GetUsersByRoleAsync(UserRole.Support);

        Assert.Equal(2, result.Count);
        Assert.All(result, u => Assert.Equal("Support", u.Role));
        Assert.Equal(["s1@x.com", "s2@x.com"], result.Select(u => u.Email).Order());
    }

    [Fact]
    public async Task GetUsersByRoleAsync_returns_empty_list_when_no_users_have_that_role()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>()).Returns([]);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.GetUsersByRoleAsync(UserRole.Tutor);

        Assert.Empty(result);
    }

    [Fact]
    public async Task SetUserActiveStatusAsync_deactivates_the_user_and_commits_once()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Support, isActive: true);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.SetUserActiveStatusAsync("usr_1", false);

        Assert.False(result.IsActive);
        Assert.False(user.IsActive);
        repository.Received(1).Update(Arg.Is<User>(u => !u.IsActive));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetUserActiveStatusAsync_reactivates_the_user()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Tutor, isActive: false);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.SetUserActiveStatusAsync("usr_1", true);

        Assert.True(result.IsActive);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetUserActiveStatusAsync_throws_NotFound_when_user_missing()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.SetUserActiveStatusAsync("missing", false));
    }

    [Fact]
    public async Task SetUserActiveStatusAsync_throws_Validation_when_deactivating_a_Master_account()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Master, isActive: true);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<ValidationException>(() => sut.SetUserActiveStatusAsync("usr_1", false));

        Assert.True(user.IsActive);
        repository.DidNotReceive().Update(Arg.Any<User>());
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetUserActiveStatusAsync_allows_reactivating_a_Master_account()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Master, isActive: false);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.SetUserActiveStatusAsync("usr_1", true);

        Assert.True(result.IsActive);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateUserDetailsAsync_updates_the_fields_and_commits_once()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Support, email: "old@x.com");
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        repository.GetByEmailAsync("new@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.UpdateUserDetailsAsync("usr_1", new UpdateUserDetailsRequest("Jane", "Doe", "new@x.com"));

        Assert.Equal("Jane", result.FirstName);
        Assert.Equal("Doe", result.LastName);
        Assert.Equal("new@x.com", result.Email);
        Assert.Equal("Jane", user.FirstName);
        Assert.Equal("Doe", user.LastName);
        Assert.Equal("new@x.com", user.Email);
        repository.Received(1).Update(Arg.Is<User>(u => u.FirstName == "Jane" && u.Email == "new@x.com"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateUserDetailsAsync_allows_keeping_the_same_email()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Support, email: "same@x.com");
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        repository.GetByEmailAsync("same@x.com", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        var result = await sut.UpdateUserDetailsAsync("usr_1", new UpdateUserDetailsRequest("Jane", "Doe", "same@x.com"));

        Assert.Equal("same@x.com", result.Email);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("", "Doe", "new@x.com")]
    [InlineData("   ", "Doe", "new@x.com")]
    [InlineData("Jane", "Doe", "")]
    [InlineData("Jane", "Doe", "   ")]
    public async Task UpdateUserDetailsAsync_throws_Validation_when_FirstName_or_Email_is_blank(string firstName, string lastName, string email)
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Support);
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<ValidationException>(
            () => sut.UpdateUserDetailsAsync("usr_1", new UpdateUserDetailsRequest(firstName, lastName, email)));

        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateUserDetailsAsync_throws_Conflict_when_email_already_taken_by_a_different_user()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var user = MakeUser(role: UserRole.Support, email: "old@x.com");
        var other = MakeUser(role: UserRole.Support, email: "taken@x.com");
        other.Id = "usr_other";
        repository.GetByIdAsync("usr_1", Arg.Any<CancellationToken>()).Returns(user);
        repository.GetByEmailAsync("taken@x.com", Arg.Any<CancellationToken>()).Returns(other);
        var sut = new UserService(repository, unitOfWork, Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<ConflictException>(
            () => sut.UpdateUserDetailsAsync("usr_1", new UpdateUserDetailsRequest("Jane", "Doe", "taken@x.com")));

        Assert.Equal("old@x.com", user.Email);
        repository.DidNotReceive().Update(Arg.Any<User>());
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateUserDetailsAsync_throws_NotFound_when_user_missing()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>(), FakeTokenService());

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.UpdateUserDetailsAsync("missing", new UpdateUserDetailsRequest("Jane", "Doe", "new@x.com")));
    }

    // A real (non-mocked) Hash/Verify pair -- not the production Pbkdf2PasswordHasher, since
    // Application.Tests deliberately doesn't reference Infrastructure (AD-1 layering), but a
    // genuine round-trippable implementation so CreateSupportUserAsync's temp-password test can
    // prove the returned plaintext actually verifies against the stored hash end-to-end, rather
    // than asserting against a stubbed-out Verify() that would always return true.
    private sealed class RoundTrippingPasswordHasherFake : IPasswordHasher
    {
        public string Hash(string password) =>
            Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(password)));

        public bool Verify(string password, string hash) => Hash(password) == hash;
    }
}
