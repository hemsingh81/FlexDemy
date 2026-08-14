namespace FlexDemy.Application.MasterData;

// AD-4: shared shape all 6 master-data repository interfaces (IBoardRepository/ICityRepository/
// ICountryRepository/IClassLevelRepository/IStateRepository/ISubjectRepository) already
// implement structurally -- GetByIdAsync/Add/Update are byte-for-byte identical across all 6,
// each concrete Infrastructure repository already gets them from the shared
// MasterDataRepository&lt;TEntity&gt; base class (Infrastructure/Repositories/MasterDataRepository.cs).
// Introduced so MasterDataService&lt;...&gt; (below) can depend on one interface for that shared
// plumbing instead of each entity's own repository interface duplicating it. GetAllAsync
// deliberately stays OFF this interface and on each entity-specific one instead -- its filter
// parameters differ per entity (Country/Subject/ClassLevel take just includeInactive; State/
// City/Board also take a parent-id filter).
public interface IMasterDataRepository<TEntity>
{
    Task<TEntity?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(TEntity entity);
    void Update(TEntity entity);
}
