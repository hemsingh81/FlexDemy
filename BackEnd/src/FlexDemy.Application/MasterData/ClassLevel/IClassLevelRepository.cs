namespace FlexDemy.Application.MasterData.ClassLevel;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetAllAsync returns results ordered by SortOrder -- ClassLevel is display-ordered, unlike the
// other 5 master-data entities. GetByIdAsync/Add/Update come from IMasterDataRepository<ClassLevel>
// (Application/MasterData) -- the shared shape all 6 master-data repositories already implemented
// identically.
public interface IClassLevelRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.ClassLevel>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.ClassLevel>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
}
