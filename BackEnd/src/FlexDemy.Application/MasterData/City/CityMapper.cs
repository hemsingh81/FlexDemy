namespace FlexDemy.Application.MasterData.City;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class CityMapper
{
    public static CityDto ToDto(this FlexDemy.Domain.MasterData.City city) => new(
        city.Id,
        city.StateId,
        city.Name,
        city.IsActive
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.City ToEntity(this CreateCityRequest request, string id) => new()
    {
        Id = id,
        StateId = request.StateId,
        Name = request.Name,
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.City city, UpdateCityRequest request)
    {
        city.StateId = request.StateId;
        city.Name = request.Name;
        city.IsActive = request.IsActive;
    }
}
