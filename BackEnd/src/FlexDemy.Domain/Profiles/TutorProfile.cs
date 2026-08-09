using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Profiles;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/TutorProfileConfiguration.cs.
// One row per User (unique index on UserId) -- created on first tutor application and
// updated in place on re-apply after rejection, rather than inserting a new row (plan §1).
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class TutorProfile : AuditableEntity
{
    public required string UserId { get; set; }
    public List<string> SubjectIds { get; set; } = [];
    public required string CountryId { get; set; }
    public required string StateId { get; set; }
    public required string CityId { get; set; }
    public string Bio { get; set; } = string.Empty;
    public string Qualifications { get; set; } = string.Empty;
    public string? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
}
