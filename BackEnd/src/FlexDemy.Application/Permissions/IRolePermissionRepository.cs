using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Permissions;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface IRolePermissionRepository
{
    Task<IReadOnlyList<RolePermission>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RolePermission>> GetByRoleAsync(UserRole role, CancellationToken cancellationToken = default);
    Task<RolePermission?> GetByRoleAndKeyAsync(UserRole role, string featureKey, CancellationToken cancellationToken = default);
    void Add(RolePermission rolePermission);
    void Update(RolePermission rolePermission);
}
