using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.State;

namespace FlexDemy.Application.MasterData.Board;

// Board validates its parent State exists and is active only when StateId is set -- national
// boards (CBSE, ICSE, IB, ...) have a null StateId and skip the check entirely (plan §2).
public class BoardService(IBoardRepository repository, IStateRepository stateRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : IBoardService
{
    public async Task<IReadOnlyList<BoardDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var boards = await repository.GetAllAsync(includeInactive, stateId, cancellationToken);
        return boards.Select(b => b.ToDto()).ToList();
    }

    public async Task<BoardDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var board = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Board), id);
        return board.ToDto();
    }

    public async Task<BoardDto> CreateAsync(CreateBoardRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.Code);
        await EnsureStateIsActiveWhenSetAsync(request.StateId, cancellationToken);
        var board = request.ToEntity(idGenerator.NewId());
        repository.Add(board);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return board.ToDto();
    }

    public async Task<BoardDto> UpdateAsync(string id, UpdateBoardRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.Code);
        var board = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Board), id);
        await EnsureStateIsActiveWhenSetAsync(request.StateId, cancellationToken);
        board.ApplyUpdate(request);
        repository.Update(board);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return board.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var board = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Board), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (BoardConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        board.IsDeleted = true;
        repository.Update(board);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

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
