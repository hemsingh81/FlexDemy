using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Subject;

namespace FlexDemy.Application.MasterData.ClassLevel;

// ClassLevel validates every referenced Subject exists and is active before create/update --
// same per-entity variance pattern as State validating its parent Country (StateService.cs).
// Unlike a parent-id check, SubjectIds is a list, so every id is validated in turn; an empty
// list is valid (Pre-Nursery..UKG intentionally map to no subjects -- ClassLevelSeedData.cs).
// Common CRUD/soft-delete plumbing lives in MasterDataService<...> (Application/MasterData).
public class ClassLevelService(IClassLevelRepository repository, ISubjectService subjectService, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    : MasterDataService<Domain.MasterData.ClassLevel, ClassLevelDto, CreateClassLevelRequest, UpdateClassLevelRequest>(repository, unitOfWork, idGenerator), IClassLevelService
{
    public async Task<IReadOnlyList<ClassLevelDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var classLevels = await repository.GetAllAsync(includeInactive, cancellationToken);
        return classLevels.Select(c => c.ToDto()).ToList();
    }

    protected override string EntityName => nameof(Domain.MasterData.ClassLevel);

    protected override void ValidateCreateFields(CreateClassLevelRequest request) => EnsureRequiredFields(request.Name);
    protected override void ValidateUpdateFields(UpdateClassLevelRequest request) => EnsureRequiredFields(request.Name);

    protected override Task EnsureCreateParentValidAsync(CreateClassLevelRequest request, CancellationToken cancellationToken) =>
        EnsureSubjectsExistAndAreActiveAsync(request.SubjectIds, cancellationToken);
    protected override Task EnsureUpdateParentValidAsync(UpdateClassLevelRequest request, CancellationToken cancellationToken) =>
        EnsureSubjectsExistAndAreActiveAsync(request.SubjectIds, cancellationToken);

    protected override Domain.MasterData.ClassLevel ToEntity(CreateClassLevelRequest request, string id) => request.ToEntity(id);
    protected override void ApplyUpdate(Domain.MasterData.ClassLevel classLevel, UpdateClassLevelRequest request) => classLevel.ApplyUpdate(request);
    protected override ClassLevelDto ToDto(Domain.MasterData.ClassLevel classLevel) => classLevel.ToDto();

    private async Task EnsureSubjectsExistAndAreActiveAsync(IReadOnlyList<string> subjectIds, CancellationToken cancellationToken)
    {
        if (subjectIds is null)
            return;

        foreach (var subjectId in subjectIds)
        {
            var subject = await subjectService.GetByIdAsync(subjectId, cancellationToken);
            if (!subject.IsActive)
                throw new ValidationException($"Subject '{subjectId}' is not active.");
        }
    }

    // Defense-in-depth: the frontend already blocks a blank Name before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
    }
}
