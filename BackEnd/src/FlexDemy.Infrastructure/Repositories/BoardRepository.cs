using FlexDemy.Application.MasterData.Board;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class BoardRepository(FlexDemyDbContext db) : MasterDataRepository<Board>(db), IBoardRepository
{
    public async Task<IReadOnlyList<Board>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var query = Db.Boards.AsNoTracking().AsQueryable();

        if (!includeInactive)
            query = query.Where(b => b.IsActive);

        if (!string.IsNullOrWhiteSpace(stateId))
            query = query.Where(b => b.StateId == stateId);

        return await query.ToListAsync(cancellationToken);
    }
}
