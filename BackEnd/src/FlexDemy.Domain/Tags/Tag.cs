using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Tags;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/TagConfiguration.cs. Deliberately standalone -- does
// NOT implement IMasterDataEntity, does NOT share MasterDataRepository<TEntity> (FR-26: "not a
// plug-in to that existing scaffold"; ARCHITECTURE-SPINE.md's Structural Seed lists Domain/Tags/
// separately from Domain/MasterData/). Id/IsActive/CreatedAt/etc. come from AuditableEntity.
public class Tag : AuditableEntity
{
    public required string Name { get; set; }
}
