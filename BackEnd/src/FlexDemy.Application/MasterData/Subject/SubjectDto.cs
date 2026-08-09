namespace FlexDemy.Application.MasterData.Subject;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record SubjectDto(
    string Id,
    string Name,
    string? Stream,
    bool IsActive
);

public record CreateSubjectRequest(
    string Name,
    string? Stream
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2).
public record UpdateSubjectRequest(
    string Name,
    string? Stream,
    bool IsActive
);
