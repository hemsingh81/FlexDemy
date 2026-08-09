using FlexDemy.Application.Common;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Users;

public class UserServiceTests
{
    private static User MakeUser(string email = "hemsingh81@gmail.com", string hash = "hashed") => new()
    {
        Id = "usr_1",
        Email = email,
        PasswordHash = hash,
        FirstName = "Hem",
        LastName = "Singh",
    };

    [Fact]
    public async Task LoginAsync_returns_the_user_when_password_matches()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        hasher.Verify("Password@123", "hashed").Returns(true);
        var sut = new UserService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher);

        var result = await sut.LoginAsync(new LoginRequest("hemsingh81@gmail.com", "Password@123"));

        Assert.Equal("hemsingh81@gmail.com", result.Email);
    }

    [Fact]
    public async Task LoginAsync_throws_Unauthorized_when_user_missing_or_password_wrong()
    {
        var repository = Substitute.For<IUserRepository>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("missing@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = new UserService(repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), hasher);

        await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.LoginAsync(new LoginRequest("missing@x.com", "whatever")));

        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        hasher.Verify("wrong", "hashed").Returns(false);
        await Assert.ThrowsAsync<UnauthorizedAppException>(
            () => sut.LoginAsync(new LoginRequest("hemsingh81@gmail.com", "wrong")));
    }

    [Fact]
    public async Task RegisterAsync_hashes_password_assigns_id_and_commits_once()
    {
        var repository = Substitute.For<IUserRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var hasher = Substitute.For<IPasswordHasher>();
        repository.GetByEmailAsync("new@x.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        idGenerator.NewId().Returns("usr_new");
        hasher.Hash("Password@123").Returns("hashed_new");
        var sut = new UserService(repository, unitOfWork, idGenerator, hasher);

        var result = await sut.RegisterAsync(new RegisterRequest("Hem", "Singh", "new@x.com", "Password@123"));

        Assert.Equal("usr_new", result.Id);
        repository.Received(1).Add(Arg.Is<User>(u => u.PasswordHash == "hashed_new" && u.Email == "new@x.com"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RegisterAsync_throws_Conflict_when_identifier_already_registered()
    {
        var repository = Substitute.For<IUserRepository>();
        repository.GetByEmailAsync("hemsingh81@gmail.com", Arg.Any<CancellationToken>()).Returns(MakeUser());
        var sut = new UserService(
            repository, Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>(), Substitute.For<IPasswordHasher>());

        await Assert.ThrowsAsync<ConflictException>(
            () => sut.RegisterAsync(new RegisterRequest("Hem", "Singh", "hemsingh81@gmail.com", "Password@123")));
    }
}
