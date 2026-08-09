using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<User?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<List<User>> GetByRoleAsync(UserRole role, CancellationToken cancellationToken = default);
    void Add(User user);
    void Update(User user);
}
