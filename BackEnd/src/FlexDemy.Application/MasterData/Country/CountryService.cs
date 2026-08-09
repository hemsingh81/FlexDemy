using FlexDemy.Application.Common;

namespace FlexDemy.Application.MasterData.Country;

public class CountryService(ICountryRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : ICountryService
{
    public async Task<IReadOnlyList<CountryDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var countries = await repository.GetAllAsync(includeInactive, cancellationToken);
        return countries.Select(c => c.ToDto()).ToList();
    }

    public async Task<CountryDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var country = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Country), id);
        return country.ToDto();
    }

    public async Task<CountryDto> CreateAsync(CreateCountryRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.IsoCode);
        var country = request.ToEntity(idGenerator.NewId());
        repository.Add(country);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return country.ToDto();
    }

    public async Task<CountryDto> UpdateAsync(string id, UpdateCountryRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name, request.IsoCode);
        var country = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Country), id);
        country.ApplyUpdate(request);
        repository.Update(country);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return country.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var country = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Country), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (CountryConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        country.IsDeleted = true;
        repository.Update(country);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Defense-in-depth: the frontend already blocks a blank Name/IsoCode before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name, string isoCode)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(isoCode))
            throw new ValidationException("ISO code is required.");
    }
}
