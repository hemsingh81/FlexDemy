namespace FlexDemy.Application.MasterData.City;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record CityDto(
    string Id,
    string StateId,
    string Name,
    bool IsActive
);

public record CreateCityRequest(
    string StateId,
    string Name
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2). StateId is included so a city can be re-parented; the
// service validates the (possibly new) parent exists and is active on every create/update.
public record UpdateCityRequest(
    string StateId,
    string Name,
    bool IsActive
);
