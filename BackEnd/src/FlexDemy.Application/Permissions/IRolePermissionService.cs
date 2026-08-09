using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Permissions;

// AD-3: plain service interface, no mediator.
public interface IRolePermissionService
{
    // Every key in FeatureKeys.AllKeys is present in the result; a role with no configured row
    // for a given key defaults to false (fail-closed), never true.
    Task<Dictionary<string, bool>> GetMineAsync(UserRole callerRole, CancellationToken cancellationToken = default);

    // Full roles x feature-keys grid for the admin checkbox matrix (FeatureKeys.AdminPermissionsManage-gated).
    // Same fail-closed default as GetMineAsync for any role x key combination with no row yet.
    Task<IReadOnlyList<RolePermissionRowDto>> GetMatrixAsync(CancellationToken cancellationToken = default);

    // Upserts each row (creates if missing, updates IsVisible if present) in one use-case
    // commit, then invalidates the cache so the change is visible on the next request.
    Task UpdateMatrixAsync(IReadOnlyList<UpdatePermissionRequest> updates, CancellationToken cancellationToken = default);
}
