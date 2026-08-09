namespace FlexDemy.Application.Profiles;

// AD-3: plain service interface, no mediator. Authorization for the Master/Support-only
// methods (GetPendingTutorApplicationsAsync, ReviewTutorApplicationAsync) is enforced by the
// controller's [Authorize(Roles=...)], not here (plan §1b).
public interface IProfileService
{
    Task<StudentProfileDto> CompleteStudentProfileAsync(string userId, CompleteStudentProfileRequest request, CancellationToken cancellationToken = default);
    Task<TutorProfileDto> SubmitTutorApplicationAsync(string userId, SubmitTutorApplicationRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileDto> SwitchRejectedTutorToStudentAsync(string userId, CompleteStudentProfileRequest request, CancellationToken cancellationToken = default);
    Task<ProfileStatusDto> GetMyProfileStatusAsync(string userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PendingTutorApplicationDto>> GetPendingTutorApplicationsAsync(CancellationToken cancellationToken = default);
    Task<TutorProfileDto> ReviewTutorApplicationAsync(string reviewerId, string targetUserId, ReviewTutorApplicationRequest request, CancellationToken cancellationToken = default);
}
