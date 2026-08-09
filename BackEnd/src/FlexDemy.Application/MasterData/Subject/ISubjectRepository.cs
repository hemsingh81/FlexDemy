namespace FlexDemy.Application.MasterData.Subject;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ISubjectRepository
{
    Task<IReadOnlyList<FlexDemy.Domain.MasterData.Subject>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<FlexDemy.Domain.MasterData.Subject?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    void Add(FlexDemy.Domain.MasterData.Subject subject);
    void Update(FlexDemy.Domain.MasterData.Subject subject);
}
