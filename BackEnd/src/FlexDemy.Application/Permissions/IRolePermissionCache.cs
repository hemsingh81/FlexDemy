using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Permissions;

// Infrastructure implementation (RolePermissionCache) wraps IMemoryCache so
// FeatureAuthorizationHandler's hot path (every policy-gated request for a non-Master caller)
// doesn't hit the database. Invalidate() is called once, by RolePermissionService.UpdateMatrixAsync,
// after a bulk update commits -- never by callers reading permissions.
public interface IRolePermissionCache
{
    Task<bool> IsVisibleAsync(UserRole role, string featureKey, CancellationToken cancellationToken = default);
    void Invalidate();
}
