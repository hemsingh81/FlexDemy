using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Country;

namespace FlexDemy.Application.MasterData.State;

// State validates its parent Country exists and is active before create/update -- this
// per-entity variance is exactly why 6 slices beat one polymorphic controller (plan §2). Common
// CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData) -- see that
// file's own comment for why the variance above survives the extraction.
public class StateService(IStateRepository repository, ICountryRepository countryRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.State, StateDto, CreateStateRequest, UpdateStateRequest>(repository, unitOfWork, idGenerator), IStateService
{
    public async Task<IReadOnlyList<StateDto>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default)
    {
        var states = await repository.GetAllAsync(includeInactive, countryId, cancellationToken);
        return states.Select(s => s.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.State);

    protected override void ValidateCreateFields(CreateStateRequest request) => EnsureRequiredFields(request.Name, request.Code);
    protected override void ValidateUpdateFields(UpdateStateRequest request) => EnsureRequiredFields(request.Name, request.Code);

    protected override Task EnsureCreateParentValidAsync(CreateStateRequest request, CancellationToken cancellationToken) =>
        EnsureCountryIsActiveAsync(request.CountryId, cancellationToken);
    protected override Task EnsureUpdateParentValidAsync(UpdateStateRequest request, CancellationToken cancellationToken) =>
        EnsureCountryIsActiveAsync(request.CountryId, cancellationToken);

    protected override Domain.MasterData.State ToEntity(CreateStateRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.State state, UpdateStateRequest request) => state.ApplyUpdate(request);
    protected override StateDto ToDto(Domain.MasterData.State state) => state.ToDto();

    private async Task EnsureCountryIsActiveAsync(string countryId, CancellationToken cancellationToken)
    {
        var country = await countryRepository.GetByIdAsync(countryId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Country), countryId);
        if (!country.IsActive)
            throw new ValidationException($"Country '{countryId}' is not active.");
    }

    // Defense-in-depth: the frontend already blocks a blank Name/Code before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name, string code)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(code))
            throw new ValidationException("Code is required.");
    }
}
