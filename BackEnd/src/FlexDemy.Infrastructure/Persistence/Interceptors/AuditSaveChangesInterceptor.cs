using FlexDemy.Application.Common;
using FlexDemy.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FlexDemy.Infrastructure.Persistence.Interceptors;

// Stamps the standard audit/lifecycle columns on every AuditableEntity so no
// Application service needs to set CreatedAt/CreatedBy/UpdatedAt/UpdatedBy itself (AD-11's
// "commit exactly once" still holds -- this runs inside that one SaveChangesAsync call, it
// doesn't add another). Registered via optionsBuilder.AddInterceptors(...) in
// FlexDemy.Infrastructure/DependencyInjection.cs, resolved from DI (not `new`'d up) because it
// depends on ICurrentUserService.
public class AuditSaveChangesInterceptor(ICurrentUserService currentUserService) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        StampAuditFields(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        StampAuditFields(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void StampAuditFields(DbContext? context)
    {
        if (context is null)
            return;

        var now = DateTimeOffset.UtcNow;
        var userId = currentUserService.UserId;

        foreach (var entry in context.ChangeTracker.Entries<AuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    // Don't clobber a value a caller deliberately set before staging the entity.
                    if (entry.Entity.CreatedAt == default)
                        entry.Entity.CreatedAt = now;
                    if (entry.Entity.CreatedBy is null)
                        entry.Entity.CreatedBy = userId;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                    break;
            }
        }
    }
}
