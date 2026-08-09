using FlexDemy.Application.Common;
using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

public class UserService(
    IUserRepository repository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IPasswordHasher passwordHasher) : IUserService
{
    public async Task<UserDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByEmailAsync(request.Identifier, cancellationToken);
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAppException("Incorrect email/phone or password.");

        return user.ToDto();
    }

    public async Task<UserDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var existing = await repository.GetByEmailAsync(request.Identifier, cancellationToken);
        if (existing is not null)
            throw new ConflictException($"An account already exists for '{request.Identifier}'.");

        var user = new User
        {
            Id = idGenerator.NewId(),
            Email = request.Identifier,
            PasswordHash = passwordHasher.Hash(request.Password),
            FirstName = request.FirstName,
            LastName = request.LastName,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        repository.Add(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }
}
