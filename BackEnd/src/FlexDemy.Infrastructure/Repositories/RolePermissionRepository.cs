using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class RolePermissionRepository(FlexDemyDbContext db) : IRolePermissionRepository
{
    public async Task<IReadOnlyList<RolePermission>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.RolePermissions.AsNoTracking().ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RolePermission>> GetByRoleAsync(UserRole role, CancellationToken cancellationToken = default) =>
        await db.RolePermissions.AsNoTracking().Where(rp => rp.Role == role).ToListAsync(cancellationToken);

    public Task<RolePermission?> GetByRoleAndKeyAsync(UserRole role, string featureKey, CancellationToken cancellationToken = default) =>
        db.RolePermissions.FirstOrDefaultAsync(rp => rp.Role == role && rp.FeatureKey == featureKey, cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(RolePermission rolePermission) => db.RolePermissions.Add(rolePermission);

    public void Update(RolePermission rolePermission) => db.RolePermissions.Update(rolePermission);
}
