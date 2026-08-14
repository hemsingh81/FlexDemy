namespace FlexDemy.Application.MasterData.Board;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetByIdAsync/Add/Update come from IMasterDataRepository<Board> (Application/MasterData) -- the
// shared shape all 6 master-data repositories already implemented identically.
public interface IBoardRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.Board>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Board>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
}
