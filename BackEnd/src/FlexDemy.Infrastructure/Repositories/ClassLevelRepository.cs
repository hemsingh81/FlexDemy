using FlexDemy.Application.MasterData.ClassLevel;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class ClassLevelRepository(FlexDemyDbContext db) : MasterDataRepository<ClassLevel>(db), IClassLevelRepository
{
    // ClassLevel is display-ordered (Pre-Nursery -> PhD/Doctorate), unlike the other 5
    // master-data entities, so this overrides the base's unordered GetAllAsync.
    public override async Task<IReadOnlyList<ClassLevel>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = Db.ClassLevels.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(c => c.IsActive);

        return await query.OrderBy(c => c.SortOrder).ToListAsync(cancellationToken);
    }
}
