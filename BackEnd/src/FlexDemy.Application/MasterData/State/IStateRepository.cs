namespace FlexDemy.Application.MasterData.State;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetByIdAsync/Add/Update come from IMasterDataRepository<State> (Application/MasterData) -- the
// shared shape all 6 master-data repositories already implemented identically.
public interface IStateRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.State>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.State>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default);
}
