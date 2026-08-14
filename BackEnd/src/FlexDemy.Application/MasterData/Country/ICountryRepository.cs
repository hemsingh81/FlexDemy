namespace FlexDemy.Application.MasterData.Country;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetByIdAsync/Add/Update come from IMasterDataRepository<Country> (Application/MasterData) -- the
// shared shape all 6 master-data repositories already implemented identically.
public interface ICountryRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.Country>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Country>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
}
