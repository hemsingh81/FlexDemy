using FlexDemy.Application.MasterData.City;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/cities")]
[Authorize]
public class CitiesController(ICityService cityService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CityDto>>> GetCities(
        [FromQuery] string? parentId,
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var cities = await cityService.GetAllAsync(effectiveIncludeInactive, parentId, cancellationToken);
        return Ok(cities);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CityDto>> GetCityById(string id, CancellationToken cancellationToken)
    {
        var city = await cityService.GetByIdAsync(id, cancellationToken);
        return Ok(city);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<CityDto>> CreateCity(CreateCityRequest request, CancellationToken cancellationToken)
    {
        var city = await cityService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCityById), new { id = city.Id }, city);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<CityDto>> UpdateCity(string id, UpdateCityRequest request, CancellationToken cancellationToken)
    {
        var city = await cityService.UpdateAsync(id, request, cancellationToken);
        return Ok(city);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteCity(string id, CancellationToken cancellationToken)
    {
        await cityService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
