using FlexDemy.Application.Common;
using FlexDemy.Domain.Common;
using FlexDemy.Domain.MasterData;

namespace FlexDemy.Application.MasterData;

// Shared CRUD/soft-delete plumbing for the 6 near-identical master-data services (Board, City,
// Country, ClassLevel, State, Subject) -- mirrors Infrastructure/Repositories/MasterDataRepository.cs,
// the equivalent shared base the repository layer already has.
//
// StateService.cs used to carry this comment: "State validates its parent Country exists and is
// active before create/update -- this per-entity variance is exactly why 6 slices beat one
// polymorphic controller." That variance is real (State needs a required parent Country; Board
// needs an optional parent State; City needs a required parent State; ClassLevel needs a list of
// Subjects; Country/Subject have no parent at all) and this abstraction does not flatten it away
// -- it survives as the 4 abstract hook methods below (ValidateCreateFields/ValidateUpdateFields
// for blank-field checks, EnsureCreateParentValidAsync/EnsureUpdateParentValidAsync for the
// parent-existence/active check), which every concrete service still implements itself. What's
// factored out here is only the identical surrounding shell every one of the 6 services
// duplicated: fetch-entity-or-NotFoundException, stage the change, SaveChangesAsync exactly once,
// map back to a DTO -- and the exact original ordering (field validation always runs before any
// parent lookup; for Update, field validation runs before the entity fetch, and the parent check
// runs after it) is preserved exactly, since StateServiceTests.cs and friends assert on it
// (e.g. "...throws_ValidationException_when_Name_or_Code_is_blank_before_checking_the_parent_country").
//
// GetAllAsync is deliberately NOT here: its filter parameters differ per entity (Country/Subject/
// ClassLevel take just includeInactive; State/City/Board also take a parent-id filter), so
// unifying it would need a parameter bag no simpler than each service's own 3-line GetAllAsync --
// every concrete service still implements it directly against its own repository interface (which
// is why derived classes keep their own constructor parameter for that interface, in addition to
// the IMasterDataRepository&lt;TEntity&gt; view this base class uses for GetByIdAsync/Add/Update).
public abstract class MasterDataService<TEntity, TDto, TCreateRequest, TUpdateRequest>(
    IMasterDataRepository<TEntity> repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator)
    where TEntity : AuditableEntity, IMasterDataEntity
{
    // Used as the NotFoundException entity name (nameof(Domain.MasterData.State) etc.) -- every
    // original service used its own entity's nameof() for this.
    protected abstract string EntityName { get; }

    public async Task<TDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var entity = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(EntityName, id);
        return ToDto(entity);
    }

    public async Task<TDto> CreateAsync(TCreateRequest request, CancellationToken cancellationToken = default)
    {
        ValidateCreateFields(request);
        await EnsureCreateParentValidAsync(request, cancellationToken);

        var entity = ToEntity(request, idGenerator.NewId());
        repository.Add(entity);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    public async Task<TDto> UpdateAsync(string id, TUpdateRequest request, CancellationToken cancellationToken = default)
    {
        ValidateUpdateFields(request);
        var entity = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(EntityName, id);
        await EnsureUpdateParentValidAsync(request, cancellationToken);

        ApplyUpdate(entity, request);
        repository.Update(entity);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var entity = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(EntityName, id);
        // Soft delete only -- IsDeleted flips the global HasQueryFilter(e => !e.IsDeleted) shut
        // for this row on every future query, with none of the FK-constraint risk a hard DELETE
        // would carry. UpdatedAt/UpdatedBy are stamped by AuditSaveChangesInterceptor on
        // SaveChanges, not here.
        entity.IsDeleted = true;
        repository.Update(entity);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Defense-in-depth blank-field checks (every original service's own EnsureRequiredFields) --
    // must run and potentially throw before any parent lookup below (existing tests assert this
    // ordering).
    protected abstract void ValidateCreateFields(TCreateRequest request);
    protected abstract void ValidateUpdateFields(TUpdateRequest request);

    // Per-entity parent-existence/active checks -- the "per-entity variance" StateService.cs's own
    // comment protects. A no-op override for the 2 entities with no parent (Country, Subject).
    protected abstract Task EnsureCreateParentValidAsync(TCreateRequest request, CancellationToken cancellationToken);
    protected abstract Task EnsureUpdateParentValidAsync(TUpdateRequest request, CancellationToken cancellationToken);

    protected abstract TEntity ToEntity(TCreateRequest request, string id);
    protected abstract void ApplyUpdate(TEntity entity, TUpdateRequest request);
    protected abstract TDto ToDto(TEntity entity);
}
