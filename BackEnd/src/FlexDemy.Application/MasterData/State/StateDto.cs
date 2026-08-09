namespace FlexDemy.Application.MasterData.State;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record StateDto(
    string Id,
    string CountryId,
    string Name,
    string Code,
    bool IsActive
);

public record CreateStateRequest(
    string CountryId,
    string Name,
    string Code
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2). CountryId is included so a state can be re-parented; the
// service validates the (possibly new) parent exists and is active on every create/update.
public record UpdateStateRequest(
    string CountryId,
    string Name,
    string Code,
    bool IsActive
);
