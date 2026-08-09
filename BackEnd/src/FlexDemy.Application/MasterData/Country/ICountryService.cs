namespace FlexDemy.Application.MasterData.Country;

// AD-3: plain service interface, no mediator.
public interface ICountryService
{
    Task<IReadOnlyList<CountryDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<CountryDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<CountryDto> CreateAsync(CreateCountryRequest request, CancellationToken cancellationToken = default);
    Task<CountryDto> UpdateAsync(string id, UpdateCountryRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
