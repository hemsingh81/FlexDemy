using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Country;

namespace FlexDemy.Application.MasterData.State;

// State validates its parent Country exists and is active before create/update -- this
// per-entity variance is exactly why 6 slices beat one polymorphic controller (plan §2).
public class StateService(IStateRepository repository, ICountryRepository countryRepository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : IStateService
{
    public async Task<IReadOnlyList<StateDto>> GetAllAsync(bool includeInactive, string? countryId, CancellationToken cancellationToken = default)
    {
        var states = await repository.GetAllAsync(includeInactive, countryId, cancellationToken);
        return states.Select(s => s.ToDto()).ToList();
    }

    public async Task<StateDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var state = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.State), id);
        return state.ToDto();
    }

    public async Task<StateDto> CreateAsync(CreateStateRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.Code);
        await EnsureCountryIsActiveAsync(request.CountryId, cancellationToken);
        var state = request.ToEntity(idGenerator.NewId());
        repository.Add(state);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return state.ToDto();
    }

    public async Task<StateDto> UpdateAsync(string id, UpdateStateRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.Code);
        var state = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.State), id);
        await EnsureCountryIsActiveAsync(request.CountryId, cancellationToken);
        state.ApplyUpdate(request);
        repository.Update(state);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return state.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var state = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.State), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (StateConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        state.IsDeleted = true;
        repository.Update(state);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

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
