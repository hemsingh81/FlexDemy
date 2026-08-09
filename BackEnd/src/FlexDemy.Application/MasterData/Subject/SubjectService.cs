using FlexDemy.Application.Common;

namespace FlexDemy.Application.MasterData.Subject;

public class SubjectService(ISubjectRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : ISubjectService
{
    public async Task<IReadOnlyList<SubjectDto>> GetAllAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var subjects = await repository.GetAllAsync(includeInactive, cancellationToken);
        return subjects.Select(s => s.ToDto()).ToList();
    }

    public async Task<SubjectDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var subject = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Subject), id);
        return subject.ToDto();
    }

    public async Task<SubjectDto> CreateAsync(CreateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        var subject = request.ToEntity(idGenerator.NewId());
        repository.Add(subject);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return subject.ToDto();
    }

    public async Task<SubjectDto> UpdateAsync(string id, UpdateSubjectRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRequiredFields(request.Name);
        var subject = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Subject), id);
        subject.ApplyUpdate(request);
        repository.Update(subject);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return subject.ToDto();
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var subject = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.MasterData.Subject), id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry (SubjectConfiguration.cs). UpdatedAt/UpdatedBy are stamped by
        // AuditSaveChangesInterceptor on SaveChanges, not here.
        subject.IsDeleted = true;
        repository.Update(subject);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Defense-in-depth: the frontend already blocks a blank Name before it ever calls
    // create/update, but the API contract shouldn't rely on that alone.
    private static void EnsureRequiredFields(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Name is required.");
    }
}
