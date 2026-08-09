namespace FlexDemy.Application.Common;

// AD-1: Application defines the interface, Infrastructure implements it against whatever
// carries the ambient caller identity (HttpContext for a live request; nothing during
// startup seeding -- UserId is null there, which is expected, see Program.cs).
// Consumed by AuditSaveChangesInterceptor to stamp CreatedBy/UpdatedBy.
public interface ICurrentUserService
{
    string? UserId { get; }
}
