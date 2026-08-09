using FlexDemy.Application.Common;

namespace FlexDemy.Infrastructure.Persistence;

public class UnitOfWork(FlexDemyDbContext db) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        db.SaveChangesAsync(cancellationToken);
}
