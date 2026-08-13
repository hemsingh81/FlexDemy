using FlexDemy.Application.Common;

namespace FlexDemy.Infrastructure.Persistence;

public class UnitOfWork(FlexDemyDbContext db) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        db.SaveChangesAsync(cancellationToken);

    // No EnableRetryOnFailure configured on this DbContext (confirmed via
    // Infrastructure/DependencyInjection.cs) -- a plain transaction is safe here without needing
    // EF Core's execution-strategy wrapper, which only matters when the provider may itself retry
    // a failed operation (which would otherwise silently re-run inside an already-started
    // transaction).
    public async Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await operation();
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
