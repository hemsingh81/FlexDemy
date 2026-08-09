using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

// Generic Add/Update/GetAll/GetById plumbing shared by the 6 master-data repositories (plan §2).
// Per-entity variance (parent-id filtering, custom ordering) is added by the thin concrete
// repository that inherits this base -- see CountryRepository/StateRepository/etc.
//
// Filters use EF.Property<T> by member name rather than a lambda on the IMasterDataEntity
// interface member directly: EF Core's LINQ translator resolves a generic TEntity parameter's
// member access against the interface's PropertyInfo, which doesn't reliably map back to the
// concrete entity's mapped column. EF.Property<T> sidesteps that by looking the property up by
// name on the actual runtime entity type, which works for both the Npgsql and InMemory providers.
public abstract class MasterDataRepository<TEntity>(FlexDemyDbContext db)
    where TEntity : class, IMasterDataEntity
{
    protected FlexDemyDbContext Db { get; } = db;

    public virtual async Task<IReadOnlyList<TEntity>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = Db.Set<TEntity>().AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(e => EF.Property<bool>(e, nameof(IMasterDataEntity.IsActive)));

        return await query.ToListAsync(cancellationToken);
    }

    public virtual Task<TEntity?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        Db.Set<TEntity>().FirstOrDefaultAsync(e => EF.Property<string>(e, nameof(IMasterDataEntity.Id)) == id, cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(TEntity entity) => Db.Set<TEntity>().Add(entity);

    public void Update(TEntity entity) => Db.Set<TEntity>().Update(entity);
}
