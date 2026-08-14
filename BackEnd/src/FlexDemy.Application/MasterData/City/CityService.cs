using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.State;

namespace FlexDemy.Application.MasterData.City;

// City validates its parent State exists and is active before create/update -- this
// per-entity variance is exactly why 6 slices beat one polymorphic controller (plan §2). Common
// CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData).
public class CityService(ICityRepository repository, IStateRepository stateRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.City, CityDto, CreateCityRequest, UpdateCityRequest>(repository, unitOfWork, idGenerator), ICityService
{
    public async Task<IReadOnlyList<CityDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var cities = await repository.GetAllAsync(includeInactive, stateId, cancellationToken);
        return cities.Select(c => c.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.City);

    protected override void ValidateCreateFields(CreateCityRequest request) => EnsureRequiredFields(request.Name);
    protected override void ValidateUpdateFields(UpdateCityRequest request) => EnsureRequiredFields(request.Name);

    protected override Task EnsureCreateParentValidAsync(CreateCityRequest request, CancellationToken cancellationToken) =>
        EnsureStateIsActiveAsync(request.StateId, cancellationToken);
    protected override Task EnsureUpdateParentValidAsync(UpdateCityRequest request, CancellationToken cancellationToken) =>
        EnsureStateIsActiveAsync(request.StateId, cancellationToken);

    protected override Domain.MasterData.City ToEntity(CreateCityRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.City city, UpdateCityRequest request) => city.ApplyUpdate(request);
    protected override CityDto ToDto(Domain.MasterData.City city) => city.ToDto();

    private async Task EnsureStateIsActiveAsync(string stateId, CancellationToken cancellationToken)
    {
        var state = await stateRepository.GetByIdAsync(stateId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.State), stateId);
        if (!state.IsActive)
            throw new ValidationException($"State '{stateId}' is not active.");
    }

    // Defense-in-depth: the frontend already blocks a blank Name before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
    }
}
