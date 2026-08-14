using FlexDemy.Application.Common;

namespace FlexDemy.Application.MasterData.Subject;

// Subject has no parent to validate -- EnsureCreateParentValidAsync/EnsureUpdateParentValidAsync
// below are the intentional no-op case MasterDataService<...>'s own comment calls out. Common
// CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData).
public class SubjectService(ISubjectRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.Subject, SubjectDto, CreateSubjectRequest, UpdateSubjectRequest>(repository, unitOfWork, idGenerator), ISubjectService
{
    public async Task<IReadOnlyList<SubjectDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var subjects = await repository.GetAllAsync(includeInactive, cancellationToken);
        return subjects.Select(s => s.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.Subject);

    protected override void ValidateCreateFields(CreateSubjectRequest request) => EnsureRequiredFields(request.Name);
    protected override void ValidateUpdateFields(UpdateSubjectRequest request) => EnsureRequiredFields(request.Name);

    protected override Task EnsureCreateParentValidAsync(CreateSubjectRequest request, CancellationToken cancellationToken) => Task.CompletedTask;
    protected override Task EnsureUpdateParentValidAsync(UpdateSubjectRequest request, CancellationToken cancellationToken) => Task.CompletedTask;

    protected override Domain.MasterData.Subject ToEntity(CreateSubjectRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.Subject subject, UpdateSubjectRequest request) => subject.ApplyUpdate(request);
    protected override SubjectDto ToDto(Domain.MasterData.Subject subject) => subject.ToDto();

    // Defense-in-depth: the frontend already blocks a blank Name before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
    }
}
