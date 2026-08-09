using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Subject;

namespace FlexDemy.Application.MasterData.ClassLevel;

// ClassLevel validates every referenced Subject exists and is active before create/update --
// same per-entity variance pattern as State validating its parent Country (StateService.cs).
// Unlike a parent-id check, SubjectIds is a list, so every id is validated in turn; an empty
// list is valid (Pre-Nursery..UKG intentionally map to no subjects -- ClassLevelSeedData.cs).
public class ClassLevelService(IClassLevelRepository repository, ISubjectService subjectService, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : IClassLevelService
{
    public async Task<IReadOnlyList<ClassLevelDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var classLevels = await repository.GetAllAsync(includeInactive, cancellationToken);
        return classLevels.Select(c => c.ToDto()).ToList();
    }

    public async Task<ClassLevelDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var classLevel = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.ClassLevel), id);
        return classLevel.ToDto();
    }

    public async Task<ClassLevelDto> CreateAsync(CreateClassLevelRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        await EnsureSubjectsExistAndAreActiveAsync(request.SubjectIds, cancellationToken);
        var classLevel = request.ToEntity(idGenerator.NewId());
        repository.Add(classLevel);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return classLevel.ToDto();
    }

    public async Task<ClassLevelDto> UpdateAsync(string id, UpdateClassLevelRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        var classLevel = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.ClassLevel), id);
        await EnsureSubjectsExistAndAreActiveAsync(request.SubjectIds, cancellationToken);
        classLevel.ApplyUpdate(request);
        repository.Update(classLevel);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return classLevel.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var classLevel = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.ClassLevel), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (ClassLevelConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        classLevel.IsDeleted = true;
        repository.Update(classLevel);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

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
