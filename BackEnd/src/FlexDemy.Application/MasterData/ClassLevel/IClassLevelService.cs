namespace FlexDemy.Application.MasterData.ClassLevel;

// AD-3: plain service interface, no mediator.
public interface IClassLevelService
{
    Task<IReadOnlyList<ClassLevelDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<ClassLevelDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<ClassLevelDto> CreateAsync(CreateClassLevelRequest request, CancellationToken cancellationToken = default);
    Task<ClassLevelDto> UpdateAsync(string id, UpdateClassLevelRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
