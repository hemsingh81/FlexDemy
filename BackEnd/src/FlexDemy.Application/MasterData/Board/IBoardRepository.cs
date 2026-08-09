namespace FlexDemy.Application.MasterData.Board;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface IBoardRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Board>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.Board?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.Board board);
    void Update(FlexDemy.Domain.MasterData.Board board);
}
