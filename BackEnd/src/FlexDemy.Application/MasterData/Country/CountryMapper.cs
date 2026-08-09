namespace FlexDemy.Application.MasterData.Country;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class CountryMapper
{
    public static CountryDto ToDto(this FlexDemy.Domain.MasterData.Country country) => new(
        country.Id,
        country.Name,
        country.IsoCode,
        country.IsActive
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.Country ToEntity(this CreateCountryRequest request, string id) => new()
    {
        Id = id,
        Name = request.Name,
        IsoCode = request.IsoCode,
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.Country country, UpdateCountryRequest request)
    {
        country.Name = request.Name;
        country.IsoCode = request.IsoCode;
        country.IsActive = request.IsActive;
    }
}
