using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.MasterData;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/SubjectConfiguration.cs.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class Subject : AuditableEntity, IMasterDataEntity
{
    public required string Name { get; set; }
    public string? Stream { get; set; }
}
