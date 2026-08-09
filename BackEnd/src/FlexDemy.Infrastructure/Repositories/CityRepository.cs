using FlexDemy.Application.MasterData.City;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CityRepository(FlexDemyDbContext db) : MasterDataRepository<City>(db), ICityRepository
{
    public async Task<IReadOnlyList<City>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var query = Db.Cities.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(c => c.IsActive);

        if (!string.IsNullOrWhiteSpace(stateId))
            query = query.Where(c => c.StateId == stateId);

        return await query.ToListAsync(cancellationToken);
    }
}
