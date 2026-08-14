namespace FlexDemy.Application.Permissions;

// Flat list of feature-key string constants (plan §3). Two kinds, undifferentiated in code:
//   - Nav keys (dashboard/discover/tutor/groups/assignments/certificates/admin) are
//     frontend-only/soft -- they only ever gate tab visibility.
//   - Action keys (courses.create/masterdata.manage/tutor.approve/admin.users.create/
//     admin.permissions.manage) are backend-enforced/hard -- they are also used as ASP.NET
//     Core policy names via FeaturePolicyProvider, e.g. [Authorize(Policy = FeatureKeys.CoursesCreate)].
// AllKeys backs both the seed data (Api/SeedData/RolePermissionSeedData.cs) and
// RolePermissionService's matrix/mine responses, so every key is always represented even for
// role x key combinations that have no explicit row yet (fail-closed default).
public static class FeatureKeys
{
    public const string Dashboard = "dashboard";
    public const string Discover = "discover";
    public const string Tutor = "tutor";
    public const string Groups = "groups";
    public const string Assignments = "assignments";
    public const string Certificates = "certificates";
    public const string Admin = "admin";

    public const string CoursesCreate = "courses.create";
    public const string MasterDataManage = "masterdata.manage";
    public const string TutorApprove = "tutor.approve";
    public const string AdminUsersCreate = "admin.users.create";
    public const string AdminPermissionsManage = "admin.permissions.manage";
    public const string AiConfigManage = "aiconfig.manage";
    public const string ErrorsManage = "errors.manage";

    public static readonly IReadOnlyList<string> AllKeys =
    [
        Dashboard, Discover, Tutor, Groups, Assignments, Certificates, Admin,
        CoursesCreate, MasterDataManage, TutorApprove, AdminUsersCreate, AdminPermissionsManage, AiConfigManage, ErrorsManage,
    ];
}
