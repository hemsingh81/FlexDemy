namespace FlexDemy.Application.MasterData.Board;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class BoardMapper
{
    public static BoardDto ToDto(this FlexDemy.Domain.MasterData.Board board) => new(
        board.Id,
        board.Name,
        board.Code,
        board.StateId,
        board.IsActive
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.Board ToEntity(this CreateBoardRequest request, string id) => new()
    {
        Id = id,
        Name = request.Name,
        Code = request.Code,
        StateId = request.StateId,
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.Board board, UpdateBoardRequest request)
    {
        board.Name = request.Name;
        board.Code = request.Code;
        board.StateId = request.StateId;
        board.IsActive = request.IsActive;
    }
}
