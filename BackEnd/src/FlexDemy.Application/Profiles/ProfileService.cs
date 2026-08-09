using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Board;
using FlexDemy.Application.MasterData.City;
using FlexDemy.Application.MasterData.ClassLevel;
using FlexDemy.Application.MasterData.Country;
using FlexDemy.Application.MasterData.State;
using FlexDemy.Application.MasterData.Subject;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Profiles;
using FlexDemy.Domain.Users;

namespace FlexDemy.Application.Profiles;

// AD-12: FK ids (ClassLevel/Board/Country/State/City/Subject) are validated by calling the
// Phase-0 master-data feature's *service* interfaces, never their repositories. Role reads/
// writes go through IUserService for the same reason.
public class ProfileService(
    IStudentProfileRepository studentProfileRepository,
    ITutorProfileRepository tutorProfileRepository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IUserService userService,
    IClassLevelService classLevelService,
    IBoardService boardService,
    ICountryService countryService,
    IStateService stateService,
    ICityService cityService,
    ISubjectService subjectService) : IProfileService
{
    public async Task<StudentProfileDto> CompleteStudentProfileAsync(string userId, CompleteStudentProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await userService.GetByIdAsync(userId, cancellationToken);
        if (user.Role != nameof(UserRole.Unassigned))
            throw new ValidationException($"Only users with role '{nameof(UserRole.Unassigned)}' may complete a student profile.");

        return await SaveStudentProfileAsync(userId, request, cancellationToken);
    }

    public async Task<StudentProfileDto> SwitchRejectedTutorToStudentAsync(string userId, CompleteStudentProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await userService.GetByIdAsync(userId, cancellationToken);
        if (user.Role != nameof(UserRole.RejectedTutor))
            throw new ValidationException($"Only users with role '{nameof(UserRole.RejectedTutor)}' may switch to a student profile.");

        return await SaveStudentProfileAsync(userId, request, cancellationToken);
    }

    public async Task<TutorProfileDto> SubmitTutorApplicationAsync(string userId, SubmitTutorApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var user = await userService.GetByIdAsync(userId, cancellationToken);
        if (user.Role != nameof(UserRole.Unassigned) && user.Role != nameof(UserRole.RejectedTutor))
        {
            throw new ValidationException(
                $"Only users with role '{nameof(UserRole.Unassigned)}' or '{nameof(UserRole.RejectedTutor)}' may submit a tutor application.");
        }

        await EnsureActiveLocationAsync(request.CountryId, request.StateId, request.CityId, cancellationToken);
        await EnsureActiveSubjectsAsync(request.SubjectIds, cancellationToken);

        var existing = await tutorProfileRepository.GetByUserIdAsync(userId, cancellationToken);

        TutorProfile profile;
        if (existing is null)
        {
            profile = request.ToEntity(idGenerator.NewId(), userId);
            tutorProfileRepository.Add(profile);
        }
        else
        {
            // Re-apply case: update the existing row in place rather than inserting a new one.
            existing.ApplyReapply(request);
            tutorProfileRepository.Update(existing);
            profile = existing;
        }

        // AD-11: this service commits once for its own repository work; AssignRoleAsync below
        // is a separate cross-feature use-case that commits its own change to User.Role.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await userService.AssignRoleAsync(userId, UserRole.PendingTutor, cancellationToken);

        return profile.ToDto();
    }

    public async Task<ProfileStatusDto> GetMyProfileStatusAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await userService.GetByIdAsync(userId, cancellationToken);

        string? rejectionReason = null;
        if (user.Role == nameof(UserRole.RejectedTutor))
        {
            var profile = await tutorProfileRepository.GetByUserIdAsync(userId, cancellationToken);
            rejectionReason = profile?.RejectionReason;
        }

        return new ProfileStatusDto(user.Role, rejectionReason);
    }

    public async Task<IReadOnlyList<PendingTutorApplicationDto>> GetPendingTutorApplicationsAsync(CancellationToken cancellationToken = default)
    {
        var pending = await tutorProfileRepository.GetPendingAsync(cancellationToken);
        var result = new List<PendingTutorApplicationDto>(pending.Count);

        foreach (var profile in pending)
        {
            var applicant = await userService.GetByIdAsync(profile.UserId, cancellationToken);
            result.Add(new PendingTutorApplicationDto(profile.ToDto(), applicant.Id, applicant.FirstName, applicant.LastName, applicant.Email));
        }

        return result;
    }

    public async Task<TutorProfileDto> ReviewTutorApplicationAsync(string reviewerId, string targetUserId, ReviewTutorApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var targetUser = await userService.GetByIdAsync(targetUserId, cancellationToken);
        if (targetUser.Role != nameof(UserRole.PendingTutor))
            throw new ValidationException($"User '{targetUserId}' does not have a pending tutor application.");

        if (!request.Approve && string.IsNullOrWhiteSpace(request.RejectionReason))
            throw new ValidationException("A rejection reason is required when rejecting a tutor application.");

        var profile = await tutorProfileRepository.GetByUserIdAsync(targetUserId, cancellationToken)
            ?? throw new NotFoundException(nameof(TutorProfile), targetUserId);

        profile.ReviewedByUserId = reviewerId;
        profile.ReviewedAt = DateTimeOffset.UtcNow;
        profile.RejectionReason = request.Approve ? null : request.RejectionReason;
        // UpdatedAt/UpdatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
        tutorProfileRepository.Update(profile);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        await userService.AssignRoleAsync(targetUserId, request.Approve ? UserRole.Tutor : UserRole.RejectedTutor, cancellationToken);

        return profile.ToDto();
    }

    private async Task<StudentProfileDto> SaveStudentProfileAsync(string userId, CompleteStudentProfileRequest request, CancellationToken cancellationToken)
    {
        await EnsureActiveClassLevelAsync(request.ClassLevelId, cancellationToken);
        await EnsureActiveBoardAsync(request.BoardId, cancellationToken);
        await EnsureActiveLocationAsync(request.CountryId, request.StateId, request.CityId, cancellationToken);
        await EnsureActiveSubjectsAsync(request.SubjectIds, cancellationToken);

        var existing = await studentProfileRepository.GetByUserIdAsync(userId, cancellationToken);

        StudentProfile profile;
        if (existing is null)
        {
            profile = request.ToEntity(idGenerator.NewId(), userId);
            studentProfileRepository.Add(profile);
        }
        else
        {
            existing.ApplyUpdate(request);
            studentProfileRepository.Update(existing);
            profile = existing;
        }

        // AD-11: this service commits once for its own repository work; AssignRoleAsync below
        // is a separate cross-feature use-case that commits its own change to User.Role.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await userService.AssignRoleAsync(userId, UserRole.Student, cancellationToken);

        return profile.ToDto();
    }

    private async Task EnsureActiveClassLevelAsync(string classLevelId, CancellationToken cancellationToken)
    {
        var classLevel = await classLevelService.GetByIdAsync(classLevelId, cancellationToken);
        if (!classLevel.IsActive)
            throw new ValidationException($"Class level '{classLevelId}' is not active.");
    }

    private async Task EnsureActiveBoardAsync(string boardId, CancellationToken cancellationToken)
    {
        var board = await boardService.GetByIdAsync(boardId, cancellationToken);
        if (!board.IsActive)
            throw new ValidationException($"Board '{boardId}' is not active.");
    }

    private async Task EnsureActiveLocationAsync(string countryId, string stateId, string cityId, CancellationToken cancellationToken)
    {
        var country = await countryService.GetByIdAsync(countryId, cancellationToken);
        if (!country.IsActive)
            throw new ValidationException($"Country '{countryId}' is not active.");

        var state = await stateService.GetByIdAsync(stateId, cancellationToken);
        if (!state.IsActive)
            throw new ValidationException($"State '{stateId}' is not active.");

        var city = await cityService.GetByIdAsync(cityId, cancellationToken);
        if (!city.IsActive)
            throw new ValidationException($"City '{cityId}' is not active.");
    }

    private async Task EnsureActiveSubjectsAsync(IReadOnlyList<string> subjectIds, CancellationToken cancellationToken)
    {
        if (subjectIds is null || subjectIds.Count == 0)
            throw new ValidationException("At least one subject must be selected.");

        foreach (var subjectId in subjectIds)
        {
            var subject = await subjectService.GetByIdAsync(subjectId, cancellationToken);
            if (!subject.IsActive)
                throw new ValidationException($"Subject '{subjectId}' is not active.");
        }
    }
}
