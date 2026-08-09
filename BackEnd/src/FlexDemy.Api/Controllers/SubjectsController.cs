using FlexDemy.Application.MasterData.Subject;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/master-data/subjects")]
[Authorize]
public class SubjectsController(ISubjectService subjectService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SubjectDto>>> GetSubjects(
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        // includeInactive is only honored for Master/Support -- everyone else always sees the
        // active-only list, matching the "add/modify/active/deactivate" master-data requirement.
        var effectiveIncludeInactive = includeInactive && (User.IsInRole(nameof(UserRole.Master)) || User.IsInRole(nameof(UserRole.Support)));
        var subjects = await subjectService.GetAllAsync(effectiveIncludeInactive, cancellationToken);
        return Ok(subjects);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SubjectDto>> GetSubjectById(string id, CancellationToken cancellationToken)
    {
        var subject = await subjectService.GetByIdAsync(id, cancellationToken);
        return Ok(subject);
    }

    [HttpPost]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<SubjectDto>> CreateSubject(CreateSubjectRequest request, CancellationToken cancellationToken)
    {
        var subject = await subjectService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetSubjectById), new { id = subject.Id }, subject);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<ActionResult<SubjectDto>> UpdateSubject(string id, UpdateSubjectRequest request, CancellationToken cancellationToken)
    {
        var subject = await subjectService.UpdateAsync(id, request, cancellationToken);
        return Ok(subject);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = FeatureKeys.MasterDataManage)]
    public async Task<IActionResult> DeleteSubject(string id, CancellationToken cancellationToken)
    {
        await subjectService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
