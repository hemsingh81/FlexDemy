using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Users;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    void Add(User user);
}
