namespace FlexDemy.Application.MasterData.Subject;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
// GetByIdAsync/Add/Update come from IMasterDataRepository<Subject> (Application/MasterData) -- the
// shared shape all 6 master-data repositories already implemented identically.
public interface ISubjectRepository : IMasterDataRepository<FlexDemy.Domain.MasterData.Subject>
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Subject>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
}
