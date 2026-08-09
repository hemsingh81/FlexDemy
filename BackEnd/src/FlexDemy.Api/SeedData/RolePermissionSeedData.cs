using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;

namespace FlexDemy.Api.SeedData;

// Dev-only role-permission seed (plan §3, Phase 4): the default matrix that exactly reproduces
// today's hardcoded [Authorize(Roles = "...")] behavior, so migrating those attributes to
// policy-based auth is a no-op for existing accounts. Only "visible" rows are seeded -- the
// whole system is fail-closed, so any role x key combination not listed here already defaults
// to not-visible without needing an explicit false row (RolePermissionService/RolePermissionCache).
public static class RolePermissionSeedData
{
    public record RolePermissionSeed(UserRole Role, string FeatureKey, bool IsVisible);

    private static readonly IReadOnlyList<string> NavKeys =
    [
        FeatureKeys.Dashboard, FeatureKeys.Discover, FeatureKeys.Tutor,
        FeatureKeys.Groups, FeatureKeys.Assignments, FeatureKeys.Certificates,
    ];

    private static readonly IReadOnlyList<UserRole> NavKeyRoles =
    [
        UserRole.Student, UserRole.Tutor, UserRole.Support, UserRole.Master,
    ];

    public static readonly IReadOnlyList<RolePermissionSeed> Defaults = BuildDefaults();

    private static IReadOnlyList<RolePermissionSeed> BuildDefaults()
    {
        var seeds = new List<RolePermissionSeed>();

        foreach (var featureKey in NavKeys)
        {
            foreach (var role in NavKeyRoles)
                seeds.Add(new RolePermissionSeed(role, featureKey, true));
        }

        // admin: Support, Master
        seeds.Add(new RolePermissionSeed(UserRole.Support, FeatureKeys.Admin, true));
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.Admin, true));

        // courses.create: Master, Tutor -- matches CoursesController.CreateCourse's prior
        // [Authorize(Roles = "Master,Tutor")].
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.CoursesCreate, true));
        seeds.Add(new RolePermissionSeed(UserRole.Tutor, FeatureKeys.CoursesCreate, true));

        // masterdata.manage: Master only -- matches the 6 master-data controllers' prior
        // [Authorize(Roles = "Master")] on their POST/PUT actions.
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.MasterDataManage, true));

        // tutor.approve: Master, Support -- matches ProfilesController's prior
        // [Authorize(Roles = "Master,Support")] on the pending-applications/review endpoints.
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.TutorApprove, true));
        seeds.Add(new RolePermissionSeed(UserRole.Support, FeatureKeys.TutorApprove, true));

        // admin.users.create: Master only -- matches AdminUsersController's prior
        // [Authorize(Roles = "Master")].
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.AdminUsersCreate, true));

        // admin.permissions.manage: Master only.
        seeds.Add(new RolePermissionSeed(UserRole.Master, FeatureKeys.AdminPermissionsManage, true));

        return seeds;
    }
}
