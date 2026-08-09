namespace FlexDemy.Application.MasterData.Country;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record CountryDto(
    string Id,
    string Name,
    string IsoCode,
    bool IsActive
);

public record CreateCountryRequest(
    string Name,
    string IsoCode
);

// IsActive lives on the update request, not a separate endpoint -- activate/deactivate is
// just a normal update (plan §2).
public record UpdateCountryRequest(
    string Name,
    string IsoCode,
    bool IsActive
);
