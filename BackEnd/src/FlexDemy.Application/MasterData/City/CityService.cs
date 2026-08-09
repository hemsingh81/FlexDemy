using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.State;

namespace FlexDemy.Application.MasterData.City;

// City validates its parent State exists and is active before create/update -- this
// per-entity variance is exactly why 6 slices beat one polymorphic controller (plan §2).
public class CityService(ICityRepository repository, IStateRepository stateRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : ICityService
{
    public async Task<IReadOnlyList<CityDto>> GetAllAsync(bool includeInactive, string? stateId, CancellationToken cancellationToken = default)
    {
        var cities = await repository.GetAllAsync(includeInactive, stateId, cancellationToken);
        return cities.Select(c => c.ToDto()).ToList();
    }

    public async Task<CityDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var city = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.City), id);
        return city.ToDto();
    }

    public async Task<CityDto> CreateAsync(CreateCityRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        await EnsureStateIsActiveAsync(request.StateId, cancellationToken);
        var city = request.ToEntity(idGenerator.NewId());
        repository.Add(city);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return city.ToDto();
    }

    public async Task<CityDto> UpdateAsync(string id, UpdateCityRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        var city = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.City), id);
        await EnsureStateIsActiveAsync(request.StateId, cancellationToken);
        city.ApplyUpdate(request);
        repository.Update(city);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return city.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var city = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.City), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (CityConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        city.IsDeleted = true;
        repository.Update(city);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

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
