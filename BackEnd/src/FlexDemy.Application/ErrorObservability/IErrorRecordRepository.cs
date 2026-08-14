using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface IErrorRecordRepository
{
    Task<ErrorRecord?> GetByFingerprintAsync(string fingerprint, CancellationToken cancellationToken = default);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    void Add(ErrorRecord record);

    // Story 4.5: the admin list view's query (FR-11/FR-12) -- every non-null ErrorListQuery
    // field ANDs together, newest LastOccurredAt first, server-side paged.
    Task<(IReadOnlyList<ErrorRecord> Items, int TotalCount)> QueryAsync(ErrorListQuery query, CancellationToken cancellationToken = default);

    Task<ErrorRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    // Story 4.6/AC #5/FR-18: purge candidates -- a Resolved row ages from ResolvedAt, an
    // Archived row ages from ArchivedAt, both compared against the same cutoff date. New
    // records are excluded by construction (only Resolved/Archived rows are ever selected).
    Task<IReadOnlyList<ErrorRecord>> GetPurgeCandidatesAsync(DateTimeOffset cutoffDate, CancellationToken cancellationToken = default);

    // AD-11: stages the removal only -- IUnitOfWork.SaveChangesAsync (called by the job) commits
    // it. The one true hard-delete path in this feature -- deliberately bypasses the soft-delete
    // convention every other repository in this codebase follows.
    void RemoveRange(IEnumerable<ErrorRecord> records);
}
