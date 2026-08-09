namespace FlexDemy.Application.MasterData.ClassLevel;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetAllAsync returns results ordered by SortOrder -- ClassLevel is display-ordered, unlike the
// other 5 master-data entities.
public interface IClassLevelRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.ClassLevel>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.ClassLevel?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.ClassLevel classLevel);
    void Update(FlexDemy.Domain.MasterData.ClassLevel classLevel);
}
