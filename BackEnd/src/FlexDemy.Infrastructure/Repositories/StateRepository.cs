using FlexDemy.Application.MasterData.State;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class StateRepository(FlexDemyDbContext db) : MasterDataRepository<State>(db), IStateRepository
{
    public async Task<IReadOnlyList<State>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default)
    {
        var query = Db.States.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(s => s.IsActive);

        if (!string.IsNullOrWhiteSpace(countryId))
            query = query.Where(s => s.CountryId == countryId);

        return await query.ToListAsync(cancellationToken);
    }
}
