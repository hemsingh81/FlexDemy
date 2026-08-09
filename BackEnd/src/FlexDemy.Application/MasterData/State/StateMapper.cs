namespace FlexDemy.Application.MasterData.State;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class StateMapper
{
    public static StateDto ToDto(this FlexDemy.Domain.MasterData.State state) => new(
        state.Id,
        state.CountryId,
        state.Name,
        state.Code,
        state.IsActive
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.State ToEntity(this CreateStateRequest request, string id) => new()
    {
        Id = id,
        CountryId = request.CountryId,
        Name = request.Name,
        Code = request.Code,
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.State state, UpdateStateRequest request)
    {
        state.CountryId = request.CountryId;
        state.Name = request.Name;
        state.Code = request.Code;
        state.IsActive = request.IsActive;
    }
}
