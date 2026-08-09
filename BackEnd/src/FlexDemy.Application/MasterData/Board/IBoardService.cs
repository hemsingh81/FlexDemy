namespace FlexDemy.Application.MasterData.Board;

// AD-3: plain service interface, no mediator.
public interface IBoardService
{
    Task<IReadOnlyList<BoardDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
    Task<BoardDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<BoardDto> CreateAsync(CreateBoardRequest request, CancellationToken cancellationToken = default);
    Task<BoardDto> UpdateAsync(string id, UpdateBoardRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
