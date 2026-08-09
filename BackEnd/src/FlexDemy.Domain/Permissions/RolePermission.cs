using FlexDemy.Domain.Common;
using FlexDemy.Domain.Users;

namespace FlexDemy.Domain.Permissions;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping (incl. the unique (Role, FeatureKey) index) lives in
// Infrastructure/Persistence/Configurations/RolePermissionConfiguration.cs.
// One row per (Role, FeatureKey) combination that is explicitly configured; a missing row
// means "not visible" -- the whole system is fail-closed by design (plan §3), so there is no
// need to seed explicit false rows, only the true ones (see Api/SeedData/RolePermissionSeedData.cs).
public class RolePermission : AuditableEntity
{
    public required UserRole Role { get; set; }
    public required string FeatureKey { get; set; }
    public bool IsVisible { get; set; }
}
