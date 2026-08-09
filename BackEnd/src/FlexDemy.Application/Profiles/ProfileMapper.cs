using FlexDemy.Domain.Profiles;

namespace FlexDemy.Application.Profiles;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class ProfileMapper
{
    public static StudentProfileDto ToDto(this StudentProfile profile) => new(
        profile.Id,
        profile.UserId,
        profile.ClassLevelId,
        profile.BoardId,
        profile.CountryId,
        profile.StateId,
        profile.CityId,
        profile.SubjectIds,
        profile.CreatedAt,
        profile.UpdatedAt
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static StudentProfile ToEntity(this CompleteStudentProfileRequest request, string id, string userId) => new()
    {
        Id = id,
        UserId = userId,
        ClassLevelId = request.ClassLevelId,
        BoardId = request.BoardId,
        CountryId = request.CountryId,
        StateId = request.StateId,
        CityId = request.CityId,
        SubjectIds = request.SubjectIds?.ToList() ?? [],
    };

    // UpdatedAt/UpdatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static void ApplyUpdate(this StudentProfile profile, CompleteStudentProfileRequest request)
    {
        profile.ClassLevelId = request.ClassLevelId;
        profile.BoardId = request.BoardId;
        profile.CountryId = request.CountryId;
        profile.StateId = request.StateId;
        profile.CityId = request.CityId;
        profile.SubjectIds = request.SubjectIds?.ToList() ?? [];
    }

    public static TutorProfileDto ToDto(this TutorProfile profile) => new(
        profile.Id,
        profile.UserId,
        profile.SubjectIds,
        profile.CountryId,
        profile.StateId,
        profile.CityId,
        profile.Bio,
        profile.Qualifications,
        profile.ReviewedByUserId,
        profile.ReviewedAt,
        profile.RejectionReason,
        profile.CreatedAt,
        profile.UpdatedAt
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static TutorProfile ToEntity(this SubmitTutorApplicationRequest request, string id, string userId) => new()
    {
        Id = id,
        UserId = userId,
        SubjectIds = request.SubjectIds?.ToList() ?? [],
        CountryId = request.CountryId,
        StateId = request.StateId,
        CityId = request.CityId,
        Bio = request.Bio,
        Qualifications = request.Qualifications,
    };

    // Re-apply after rejection updates the existing row in place and clears the prior review
    // outcome, rather than inserting a new TutorProfile (plan §1). UpdatedAt/UpdatedBy are
    // stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static void ApplyReapply(this TutorProfile profile, SubmitTutorApplicationRequest request)
    {
        profile.SubjectIds = request.SubjectIds?.ToList() ?? [];
        profile.CountryId = request.CountryId;
        profile.StateId = request.StateId;
        profile.CityId = request.CityId;
        profile.Bio = request.Bio;
        profile.Qualifications = request.Qualifications;
        profile.ReviewedByUserId = null;
        profile.ReviewedAt = null;
        profile.RejectionReason = null;
    }
}
