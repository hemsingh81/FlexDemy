namespace FlexDemy.Application.MasterData.City;

// AD-3: plain service interface, no mediator.
public interface ICityService
{
    Task<IReadOnlyList<CityDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
    Task<CityDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<CityDto> CreateAsync(CreateCityRequest request, CancellationToken cancellationToken = default);
    Task<CityDto> UpdateAsync(string id, UpdateCityRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
