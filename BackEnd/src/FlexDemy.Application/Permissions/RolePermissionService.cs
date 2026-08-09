using FlexDemy.Application.Common;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Permissions;

public class RolePermissionService(
    IRolePermissionRepository repository,
    IRolePermissionCache cache,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator) : IRolePermissionService
{
    // The admin matrix only manages the 4 operational roles (plan §3's default-matrix table).
    // Unassigned/PendingTutor/RejectedTutor are profile-completion funnel states (plan §1) that
    // are always routed to onboarding screens regardless of feature flags, so they have no
    // meaningful permission set for Master to edit; FeatureAuthorizationHandler still fails
    // closed for them via the normal "no row -> not visible" path if one somehow reached a
    // policy-gated endpoint.
    private static readonly IReadOnlyList<UserRole> ManagedRoles =
    [
        UserRole.Student, UserRole.Tutor, UserRole.Support, UserRole.Master,
    ];

    public async Task<Dictionary<string, bool>> GetMineAsync(UserRole callerRole, CancellationToken cancellationToken = default)
    {
        var rows = await repository.GetByRoleAsync(callerRole, cancellationToken);
        var visibleKeys = rows.Where(r => r.IsVisible).Select(r => r.FeatureKey).ToHashSet(StringComparer.Ordinal);

        // Fail-closed: every key in FeatureKeys.AllKeys is present; a key with no row for this
        // role defaults to false, not true.
        return FeatureKeys.AllKeys.ToDictionary(key => key, key => visibleKeys.Contains(key));
    }

    public async Task<IReadOnlyList<RolePermissionRowDto>> GetMatrixAsync(CancellationToken cancellationToken = default)
    {
        var rows = await repository.GetAllAsync(cancellationToken);
        var visible = rows.Where(r => r.IsVisible)
            .Select(r => (r.Role, r.FeatureKey))
            .ToHashSet();

        var matrix = new List<RolePermissionRowDto>(ManagedRoles.Count * FeatureKeys.AllKeys.Count);
        foreach (var role in ManagedRoles)
        {
            foreach (var key in FeatureKeys.AllKeys)
            {
                matrix.Add(new RolePermissionRowDto(role.ToString(), key, visible.Contains((role, key))));
            }
        }

        return matrix;
    }

    public async Task UpdateMatrixAsync(IReadOnlyList<UpdatePermissionRequest> updates, CancellationToken cancellationToken = default)
    {
        foreach (var update in updates)
        {
            if (!Enum.TryParse<UserRole>(update.Role, out var role))
                throw new ValidationException($"'{update.Role}' is not a valid role.");

            var existing = await repository.GetByRoleAndKeyAsync(role, update.FeatureKey, cancellationToken);

            if (existing is null)
            {
                repository.Add(new RolePermission
                {
                    Id = idGenerator.NewId(),
                    Role = role,
                    FeatureKey = update.FeatureKey,
                    IsVisible = update.IsVisible,
                });
            }
            else
            {
                existing.IsVisible = update.IsVisible;
                repository.Update(existing);
            }
        }

        // AD-11: one commit for the whole bulk update, then invalidate so the next request
        // (this one's cache included) sees the change instead of a stale cached value.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        cache.Invalidate();
    }
}
