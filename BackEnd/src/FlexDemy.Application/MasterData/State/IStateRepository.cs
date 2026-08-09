namespace FlexDemy.Application.MasterData.State;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface IStateRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.State>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.State?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.State state);
    void Update(FlexDemy.Domain.MasterData.State state);
}
