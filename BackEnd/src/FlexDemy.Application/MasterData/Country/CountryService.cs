using FlexDemy.Application.Common;

namespace FlexDemy.Application.MasterData.Country;

// Country has no parent to validate -- EnsureCreateParentValidAsync/EnsureUpdateParentValidAsync
// below are the intentional no-op case MasterDataService<...>'s own comment calls out. Common
// CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData).
public class CountryService(ICountryRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.Country, CountryDto, CreateCountryRequest, UpdateCountryRequest>(repository, unitOfWork, idGenerator), ICountryService
{
    public async Task<IReadOnlyList<CountryDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var countries = await repository.GetAllAsync(includeInactive, cancellationToken);
        return countries.Select(c => c.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.Country);

    protected override void ValidateCreateFields(CreateCountryRequest request) => EnsureRequiredFields(request.Name, request.IsoCode);
    protected override void ValidateUpdateFields(UpdateCountryRequest request) => EnsureRequiredFields(request.Name, request.IsoCode);

    protected override Task EnsureCreateParentValidAsync(CreateCountryRequest request, CancellationToken cancellationToken) => Task.CompletedTask;
    protected override Task EnsureUpdateParentValidAsync(UpdateCountryRequest request, CancellationToken cancellationToken) => Task.CompletedTask;

    protected override Domain.MasterData.Country ToEntity(CreateCountryRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.Country country, UpdateCountryRequest request) => country.ApplyUpdate(request);
    protected override CountryDto ToDto(Domain.MasterData.Country country) => country.ToDto();

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
