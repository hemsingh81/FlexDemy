using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.MasterData;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/StateConfiguration.cs.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class State : AuditableEntity, IMasterDataEntity
{
    public required string CountryId { get; set; }
    public required string Name { get; set; }
    public required string Code { get; set; }
}
