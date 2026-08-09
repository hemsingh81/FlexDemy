using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Profiles;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/StudentProfileConfiguration.cs.
// One row per User (unique index on UserId) -- created when Role transitions
// Unassigned/RejectedTutor -> Student (plan §1).
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class StudentProfile : AuditableEntity
{
    public required string UserId { get; set; }
    public required string ClassLevelId { get; set; }
    public required string BoardId { get; set; }
    public required string CountryId { get; set; }
    public required string StateId { get; set; }
    public required string CityId { get; set; }
    public List<string> SubjectIds { get; set; } = [];
}
