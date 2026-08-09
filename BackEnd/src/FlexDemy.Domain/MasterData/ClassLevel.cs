using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.MasterData;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/ClassLevelConfiguration.cs.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class ClassLevel : AuditableEntity, IMasterDataEntity
{
    public required string Name { get; set; }
    public int SortOrder { get; set; }

    // List<Subject.Id> applicable to this class level -- maps straight to a Postgres text[]
    // column with no explicit EF configuration, same as StudentProfile.SubjectIds
    // (Domain/Profiles/StudentProfile.cs).
    public List<string> SubjectIds { get; set; } = [];
}
