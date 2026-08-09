namespace FlexDemy.Application.Profiles;

// AD-10: services accept/return DTOs only at their public boundary -- Domain entities
// never cross out of Application. Naming per AD-5's Consistency Conventions.
public record StudentProfileDto(
    string Id,
    string UserId,
    string ClassLevelId,
    string BoardId,
    string CountryId,
    string StateId,
    string CityId,
    IReadOnlyList<string> SubjectIds,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);

public record TutorProfileDto(
    string Id,
    string UserId,
    IReadOnlyList<string> SubjectIds,
    string CountryId,
    string StateId,
    string CityId,
    string Bio,
    string Qualifications,
    string? ReviewedByUserId,
    DateTimeOffset? ReviewedAt,
    string? RejectionReason,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);

// Returned by GET /api/v1/profiles/me/status -- RejectionReason is only populated when
// Role is RejectedTutor, null otherwise (plan §1b).
public record ProfileStatusDto(string Role, string? RejectionReason);

// A pending tutor application bundled with a slice of the applicant's identity, resolved via
// IUserService (AD-12: cross-feature reads go through the owning feature's service interface,
// never its repository) rather than a DB join.
public record PendingTutorApplicationDto(
    TutorProfileDto Profile,
    string UserId,
    string FirstName,
    string LastName,
    string Email
);

public record CompleteStudentProfileRequest(
    string ClassLevelId,
    string BoardId,
    string CountryId,
    string StateId,
    string CityId,
    IReadOnlyList<string> SubjectIds
);

public record SubmitTutorApplicationRequest(
    IReadOnlyList<string> SubjectIds,
    string CountryId,
    string StateId,
    string CityId,
    string Bio,
    string Qualifications
);

public record ReviewTutorApplicationRequest(bool Approve, string? RejectionReason);
