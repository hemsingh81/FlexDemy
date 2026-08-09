namespace FlexDemy.Application.MasterData.State;

// AD-3: plain service interface, no mediator.
public interface IStateService
{
    Task<IReadOnlyList<StateDto>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default);
    Task<StateDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<StateDto> CreateAsync(CreateStateRequest request, CancellationToken cancellationToken = default);
    Task<StateDto> UpdateAsync(string id, UpdateStateRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
