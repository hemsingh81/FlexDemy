namespace FlexDemy.Application.MasterData.City;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetByIdAsync/Add/Update come from IMasterDataRepository<City> (Application/MasterData) -- the
// shared shape all 6 master-data repositories already implemented identically.
public interface ICityRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.City>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.City>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
}
