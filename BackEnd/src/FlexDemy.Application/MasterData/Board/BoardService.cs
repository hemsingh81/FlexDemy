using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.State;

namespace FlexDemy.Application.MasterData.Board;

// Board validates its parent State exists and is active only when StateId is set -- national
// boards (CBSE, ICSE, IB, ...) have a null StateId and skip the check entirely (plan §2). Common
// CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData).
public class BoardService(IBoardRepository repository, IStateRepository stateRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.Board, BoardDto, CreateBoardRequest, UpdateBoardRequest>(repository, unitOfWork, idGenerator), IBoardService
{
    public async Task<IReadOnlyList<BoardDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var boards = await repository.GetAllAsync(includeInactive, stateId, cancellationToken);
        return boards.Select(b => b.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.Board);

    protected override void ValidateCreateFields(CreateBoardRequest request) => EnsureRequiredFields(request.Name, request.Code);
    protected override void ValidateUpdateFields(UpdateBoardRequest request) => EnsureRequiredFields(request.Name, request.Code);

    protected override Task EnsureCreateParentValidAsync(CreateBoardRequest request, CancellationToken cancellationToken) =>
        EnsureStateIsActiveWhenSetAsync(request.StateId, cancellationToken);
    protected override Task EnsureUpdateParentValidAsync(UpdateBoardRequest request, CancellationToken cancellationToken) =>
        EnsureStateIsActiveWhenSetAsync(request.StateId, cancellationToken);

    protected override Domain.MasterData.Board ToEntity(CreateBoardRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.Board board, UpdateBoardRequest request) => board.ApplyUpdate(request);
    protected override BoardDto ToDto(Domain.MasterData.Board board) => board.ToDto();

    private async Task EnsureStateIsActiveWhenSetAsync(string? stateId, CancellationToken cancellationToken)
    {
        if (stateId is null)
            return;

        var state = await stateRepository.GetByIdAsync(stateId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.State), stateId);
        if (!state.IsActive)
            throw new ValidationException($"State '{stateId}' is not active.");
    }

    // Defense-in-depth: the frontend already blocks a blank Name/Code before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name, string code)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(code))
            throw new ValidationException("Code is required.");
    }
}
