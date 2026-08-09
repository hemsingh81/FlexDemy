using System.Security.Cryptography;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

public class UserService(
    IUserRepository repository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IPasswordHasher passwordHasher,
    ITokenService tokenService) : IUserService
{
    // Charset avoids visually-ambiguous characters (0/O, 1/l/I) while still mixing
    // upper/lower/digit/symbol -- this is a one-time relayed-out-of-band credential, not a
    // long-lived secret, so simple uniform sampling (no rejection sampling for modulo bias) is fine.
    private const string TempPasswordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
    private const int TempPasswordLength = 12;

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByEmailAsync(request.Identifier, cancellationToken);
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAppException("Incorrect email/phone or password.");

        if (!user.IsActive)
            throw new UnauthorizedAppException("This account has been deactivated. Contact an administrator.");

        return new AuthResponse(user.ToDto(), tokenService.GenerateToken(user), user.MustChangePassword);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
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
            Role = UserRole.Unassigned, // self-registration lands Unassigned; the user picks Student or Tutor via
                                         // the Profiles feature's completion/application flow (plan §1). Support/Master
                                         // are never self-registered -- always admin-seeded/assigned.
            // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges.
        };

        repository.Add(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new AuthResponse(user.ToDto(), tokenService.GenerateToken(user), user.MustChangePassword);
    }

    public async Task<UserDto> GetByIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);
        return user.ToDto();
    }

    public async Task<UserDto> AssignRoleAsync(string userId, UserRole newRole, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);
        user.Role = newRole;
        repository.Update(user);
        // AD-11: this is a full use-case in its own right (the Profiles feature calls it as a
        // cross-feature service dependency, per AD-12), so it commits once here.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }

    public async Task<List<UserDto>> GetUsersByRoleAsync(UserRole role, CancellationToken cancellationToken = default)
    {
        var users = await repository.GetByRoleAsync(role, cancellationToken);
        return users.Select(u => u.ToDto()).ToList();
    }

    public async Task<UserDto> SetUserActiveStatusAsync(string userId, bool isActive, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);
        if (user.Role == UserRole.Master && !isActive)
            throw new ValidationException("Master accounts cannot be deactivated.");
        user.IsActive = isActive;
        repository.Update(user);
        // AuditSaveChangesInterceptor stamps UpdatedAt/UpdatedBy automatically -- no manual
        // stamping needed here (AD-11).
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }

    public async Task<CreateSupportUserResponse> CreateSupportUserAsync(CreateSupportUserRequest request, CancellationToken cancellationToken = default)
    {
        var existing = await repository.GetByEmailAsync(request.Identifier, cancellationToken);
        if (existing is not null)
            throw new ConflictException($"An account already exists for '{request.Identifier}'.");

        var temporaryPassword = GenerateTemporaryPassword();
        var user = new User
        {
            Id = idGenerator.NewId(),
            Email = request.Identifier,
            PasswordHash = passwordHasher.Hash(temporaryPassword),
            FirstName = request.FirstName,
            LastName = request.LastName,
            Role = UserRole.Support,
            MustChangePassword = true,
            // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges.
        };

        repository.Add(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        // Plaintext returned exactly once here -- never persisted, never logged.
        return new CreateSupportUserResponse(user.ToDto(), temporaryPassword);
    }

    public async Task<UserDto> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAppException("Current password is incorrect.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        user.MustChangePassword = false;
        repository.Update(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }

    public async Task<UserDto> UpdateUserDetailsAsync(string userId, UpdateUserDetailsRequest request, CancellationToken cancellationToken = default)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        EnsureRequiredFields(request.FirstName, request.Email);

        var existing = await repository.GetByEmailAsync(request.Email, cancellationToken);
        if (existing is not null && existing.Id != userId)
            throw new ConflictException($"An account already exists for '{request.Email}'.");

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.Email = request.Email;
        repository.Update(user);
        // AuditSaveChangesInterceptor stamps UpdatedAt/UpdatedBy automatically -- no manual
        // stamping needed here (AD-11).
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }

    // Defense-in-depth: the frontend already blocks blank First Name/Email before it ever calls
    // update, but the API contract shouldn't rely on that alone (mirrors MasterData services'
    // EnsureRequiredFields pattern).
    private static void EnsureRequiredFields(string firstName, string email)
    {
        if (string.IsNullOrWhiteSpace(firstName))
            throw new ValidationException("First name is required.");
        if (string.IsNullOrWhiteSpace(email))
            throw new ValidationException("Email is required.");
    }

    private static string GenerateTemporaryPassword()
    {
        var bytes = RandomNumberGenerator.GetBytes(TempPasswordLength);
        var chars = new char[TempPasswordLength];
        for (var i = 0; i < TempPasswordLength; i++)
            chars[i] = TempPasswordChars[bytes[i] % TempPasswordChars.Length];
        return new string(chars);
    }
}
