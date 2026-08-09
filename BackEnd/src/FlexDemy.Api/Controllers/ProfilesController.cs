using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
// The Unassigned/RejectedTutor/PendingTutor role checks that gate each transition live in
// ProfileService, not here -- [Authorize] only requires "some authenticated user" for the
// self-service endpoints (plan §1b).
[ApiController]
[Route("api/v1/profiles")]
[Authorize]
public class ProfilesController(IProfileService profileService) : ControllerBase
{
    [HttpPost("student")]
    public async Task<ActionResult<StudentProfileDto>> CompleteStudentProfile(CompleteStudentProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        var role = CurrentUserRole();

        var profile = role == nameof(UserRole.RejectedTutor)
            ? await profileService.SwitchRejectedTutorToStudentAsync(userId, request, cancellationToken)
            : await profileService.CompleteStudentProfileAsync(userId, request, cancellationToken);

        return Ok(profile);
    }

    [HttpPost("tutor")]
    public async Task<ActionResult<TutorProfileDto>> SubmitTutorApplication(SubmitTutorApplicationRequest request, CancellationToken cancellationToken)
    {
        var profile = await profileService.SubmitTutorApplicationAsync(CurrentUserId(), request, cancellationToken);
        return Ok(profile);
    }

    [HttpGet("me/status")]
    public async Task<ActionResult<ProfileStatusDto>> GetMyProfileStatus(CancellationToken cancellationToken)
    {
        var status = await profileService.GetMyProfileStatusAsync(CurrentUserId(), cancellationToken);
        return Ok(status);
    }

    [HttpGet("tutor-applications/pending")]
    [Authorize(Policy = FeatureKeys.TutorApprove)]
    public async Task<ActionResult<IReadOnlyList<PendingTutorApplicationDto>>> GetPendingTutorApplications(CancellationToken cancellationToken)
    {
        var applications = await profileService.GetPendingTutorApplicationsAsync(cancellationToken);
        return Ok(applications);
    }

    [HttpPost("tutor-applications/{userId}/review")]
    [Authorize(Policy = FeatureKeys.TutorApprove)]
    public async Task<ActionResult<TutorProfileDto>> ReviewTutorApplication(string userId, ReviewTutorApplicationRequest request, CancellationToken cancellationToken)
    {
        var profile = await profileService.ReviewTutorApplicationAsync(CurrentUserId(), userId, request, cancellationToken);
        return Ok(profile);
    }

    // JwtTokenService issues "sub"; whether it surfaces as ClaimTypes.NameIdentifier depends
    // on JwtBearerOptions.MapInboundClaims (defaulted, not set explicitly in Program.cs), so
    // both are checked rather than relying on that default.
    private string CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new InvalidOperationException("Authenticated request is missing a user id claim.");

    private string? CurrentUserRole() => User.FindFirstValue(ClaimTypes.Role);
}
