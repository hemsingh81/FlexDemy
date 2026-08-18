using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Common;

// AD-1: Application defines the interface, Infrastructure implements it against whatever
// carries the ambient caller identity (HttpContext for a live request; nothing during
// startup seeding -- UserId is null there, which is expected, see Program.cs).
// Consumed by AuditSaveChangesInterceptor to stamp CreatedBy/UpdatedBy.
public interface ICurrentUserService
{
    string? UserId { get; }

    // Story 11.3, AD-29: the caller's role, for data-dependent read authorization (e.g.
    // CourseService.EnsureReadableAsync's reviewer/Admin branch) -- distinct from
    // FeatureAuthorizationHandler's own ClaimTypes.Role read, which gates a controller action's
    // very reachability ("can this role use this admin feature at all"), not "given this specific
    // record's current state, may this caller read it." Null when there's no authenticated
    // context or the role claim doesn't parse, same posture as UserId above.
    UserRole? Role { get; }
}
