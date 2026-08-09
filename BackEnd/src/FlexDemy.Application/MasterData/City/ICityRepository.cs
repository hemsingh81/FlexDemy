namespace FlexDemy.Application.MasterData.City;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ICityRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.City>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.City?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.City city);
    void Update(FlexDemy.Domain.MasterData.City city);
}
