using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.MasterData;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/BoardConfiguration.cs.
// StateId is null for national/international boards (CBSE, ICSE, IB, ...) and set only for the
// per-state "<State> State Board" rows.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class Board : AuditableEntity, IMasterDataEntity
{
    public required string Name { get; set; }
    public required string Code { get; set; }
    public string? StateId { get; set; }
}
