namespace FlexDemy.Application.MasterData.Board;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record BoardDto(
    string Id,
    string Name,
    string Code,
    string? StateId,
    bool IsActive
);

public record CreateBoardRequest(
    string Name,
    string Code,
    string? StateId
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2).
public record UpdateBoardRequest(
    string Name,
    string Code,
    string? StateId,
    bool IsActive
);
