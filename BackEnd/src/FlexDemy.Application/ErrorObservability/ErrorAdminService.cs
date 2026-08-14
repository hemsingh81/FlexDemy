using FlexDemy.Application.Common;
using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// Story 4.6: gained IUnitOfWork -- no longer a pure-read service now that Archive/Resolve/
// Increase-Priority write. AD-11: one SaveChangesAsync per use-case, after the repository's
// already-tracked entity has been mutated in place (same pattern as ErrorCaptureService's own
// ApplyRepeatOccurrence -- no explicit repository.Update() call needed for an entity that's
// already tracked by this Scoped service's own DbContext-backed repository).
public class ErrorAdminService(
    IErrorRecordRepository repository,
    IUnitOfWork unitOfWork,
    IErrorRetentionSettingsRepository retentionSettingsRepository) : IErrorAdminService
{
    // FR-18's stated default -- used both when no settings row exists yet (read path) and to
    // seed a new one if UpdateRetentionSettingsAsync is called before any row exists (write path).
    private const int DefaultRetentionDays = 180;

    // Code-review patch: an unbounded retentionDays lets DateTimeOffset.UtcNow.AddDays(-retentionDays)
    // throw ArgumentOutOfRangeException inside the purge job once the offset exceeds
    // DateTimeOffset.MinValue -- 10 years comfortably covers any legitimate retention policy
    // while ruling that out.
    private const int MaxRetentionDays = 3650;

    public async Task<PagedResult<ErrorRecordSummaryDto>> GetListAsync(ErrorListQuery query, CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await repository.QueryAsync(query, cancellationToken);
        return new PagedResult<ErrorRecordSummaryDto>(items.Select(r => r.ToSummaryDto()).ToList(), totalCount, query.Page, query.PageSize);
    }

    public async Task<ErrorRecordDetailDto> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var record = await GetRecordOrThrowAsync(id, cancellationToken);
        return record.ToDetailDto();
    }

    public async Task ArchiveAsync(string id, CancellationToken cancellationToken = default)
    {
        var record = await GetRecordOrThrowAsync(id, cancellationToken);
        // Code-review patch: a backend guard against a redundant same-state transition -- matches
        // IncreasePriorityAsync's own "defense in depth, not just a disabled UI button" precedent,
        // which Archive/Resolve previously lacked.
        if (record.Status == ErrorStatus.Archived)
            throw new ValidationException("This error is already archived.");

        record.Status = ErrorStatus.Archived;
        record.ArchivedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ResolveAsync(string id, string resolvedByUserId, CancellationToken cancellationToken = default)
    {
        var record = await GetRecordOrThrowAsync(id, cancellationToken);
        // Code-review patch: same guard as Archive above -- also makes Resolve idempotency-safe
        // against re-attribution (a double-click no longer silently overwrites
        // ResolvedByUserId/ResolvedAt with whoever/whenever called it most recently).
        if (record.Status == ErrorStatus.Resolved)
            throw new ValidationException("This error is already resolved.");

        record.Status = ErrorStatus.Resolved;
        record.ResolvedAt = DateTimeOffset.UtcNow;
        record.ResolvedByUserId = resolvedByUserId;
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task IncreasePriorityAsync(string id, string increasedByUserId, CancellationToken cancellationToken = default)
    {
        var record = await GetRecordOrThrowAsync(id, cancellationToken);
        if (record.Priority == ErrorPriority.P0)
            throw new ValidationException("Already at the highest priority (P0).");

        record.Priority = ErrorPriorityAssigner.IncreaseOneStep(record.Priority);
        record.PriorityIncreasedAt = DateTimeOffset.UtcNow;
        record.PriorityIncreasedByUserId = increasedByUserId;
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<ErrorRetentionSettingsDto> GetRetentionSettingsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await retentionSettingsRepository.GetAsync(cancellationToken);
        return new ErrorRetentionSettingsDto(settings?.RetentionDays ?? DefaultRetentionDays);
    }

    public async Task<ErrorRetentionSettingsDto> UpdateRetentionSettingsAsync(int retentionDays, CancellationToken cancellationToken = default)
    {
        if (retentionDays <= 0 || retentionDays > MaxRetentionDays)
            throw new ValidationException($"Retention days must be between 1 and {MaxRetentionDays}.");

        var settings = await retentionSettingsRepository.GetAsync(cancellationToken);
        if (settings is null)
        {
            // Self-healing: the row should always exist (DatabaseSeeder seeds it), but a write
            // action shouldn't hard-fail on a missing settings row when creating it is trivial
            // and unambiguous. Uses the same well-known SingletonId as the seeder (not
            // idGenerator.NewId()) -- code-review patch: a fixed Id makes "at most one row"
            // enforced by the table's own primary-key constraint, so two concurrent callers
            // racing this exact branch collide on the PK (one throws) instead of silently
            // creating two rows.
            settings = new ErrorRetentionSettings { Id = ErrorRetentionSettings.SingletonId, RetentionDays = retentionDays };
            retentionSettingsRepository.Add(settings);
        }
        else
        {
            settings.RetentionDays = retentionDays;
            retentionSettingsRepository.Update(settings);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new ErrorRetentionSettingsDto(settings.RetentionDays);
    }

    private async Task<ErrorRecord> GetRecordOrThrowAsync(string id, CancellationToken cancellationToken) =>
        await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.ErrorObservability.ErrorRecord), id);
}
