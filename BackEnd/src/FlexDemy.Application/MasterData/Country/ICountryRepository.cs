namespace FlexDemy.Application.MasterData.Country;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICountryRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Country>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.Country?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.Country country);
    void Update(FlexDemy.Domain.MasterData.Country country);
}
