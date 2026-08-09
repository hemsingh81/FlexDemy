namespace FlexDemy.Application.MasterData.Subject;

// AD-3: plain service interface, no mediator.
public interface ISubjectService
{
    Task<IReadOnlyList<SubjectDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<SubjectDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<SubjectDto> CreateAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default);
    Task<SubjectDto> UpdateAsync(string id, UpdateSubjectRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
