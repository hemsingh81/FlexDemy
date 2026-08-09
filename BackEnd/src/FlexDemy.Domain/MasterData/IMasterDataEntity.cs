namespace FlexDemy.Domain.MasterData;

// Shared shape for the 6 master-data entities so
// Infrastructure/Repositories/MasterDataRepository{TEntity} can implement Add/Update/GetAll/GetById
// once instead of once per entity. Plain C# interface -- not framework-specific, doesn't violate
// the "no EF attributes on Domain" rule (ARCHITECTURE-SPINE.md AD-4).
public interface IMasterDataEntity
{
    string Id { get; set; }
    bool IsActive { get; set; }
}
