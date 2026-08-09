namespace FlexDemy.Application.MasterData.ClassLevel;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record ClassLevelDto(
    string Id,
    string Name,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<string> SubjectIds
);

public record CreateClassLevelRequest(
    string Name,
    int SortOrder,
    IReadOnlyList<string> SubjectIds
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2).
public record UpdateClassLevelRequest(
    string Name,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<string> SubjectIds
);
