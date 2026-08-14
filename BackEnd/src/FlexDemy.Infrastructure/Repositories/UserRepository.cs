using FlexDemy.Application.Users;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class UserRepository(FlexDemyDbContext db) : IUserRepository
{
    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

    public Task<User?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    public Task<List<User>> GetByRoleAsync(UserRole role, CancellationToken cancellationToken = default) =>
        db.Users.AsNoTracking().Where(u => u.Role == role).ToListAsync(cancellationToken);

    public void Add(User user) => db.Users.Add(user);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Update(User user) => db.Users.Update(user);
}
