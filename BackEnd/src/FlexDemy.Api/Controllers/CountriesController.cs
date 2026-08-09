using FlexDemy.Application.MasterData.Country;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/countries")]
[Authorize]
public class CountriesController(ICountryService countryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CountryDto>>> GetCountries(
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var countries = await countryService.GetAllAsync(effectiveIncludeInactive, cancellationToken);
        return Ok(countries);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CountryDto>> GetCountryById(string id, CancellationToken cancellationToken)
    {
        var country = await countryService.GetByIdAsync(id, cancellationToken);
        return Ok(country);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<CountryDto>> CreateCountry(CreateCountryRequest request, CancellationToken cancellationToken)
    {
        var country = await countryService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCountryById), new { id = country.Id }, country);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<CountryDto>> UpdateCountry(string id, UpdateCountryRequest request, CancellationToken cancellationToken)
    {
        var country = await countryService.UpdateAsync(id, request, cancellationToken);
        return Ok(country);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteCountry(string id, CancellationToken cancellationToken)
    {
        await countryService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
