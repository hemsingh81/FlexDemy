using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.ErrorObservability;

// AD-24: placed under Infrastructure/ErrorObservability/ per the backend architecture spine's
// explicit Structural Seed naming, not the general Infrastructure/Repositories/ folder other
// features use -- the spine names this folder specifically.
public class ErrorRecordRepository(FlexDemyDbContext db) : IErrorRecordRepository
{
    // Code-review patch: an unbounded PageSize lets any Master-authenticated caller force a
    // full-table read in one request.
    private const int MaxPageSize = 100;

    public Task<ErrorRecord?> GetByFingerprintAsync(string fingerprint, CancellationToken cancellationToken = default) =>
        db.ErrorRecords.FirstOrDefaultAsync(r => r.Fingerprint == fingerprint, cancellationToken);

    public void Add(ErrorRecord record) => db.ErrorRecords.Add(record);

    // Story 4.5: a plain ToLower()/Contains() comparison for Search, not EF.Functions.ILike --
    // this codebase already moved off ILike for exactly this kind of free-text match (see
    // TagRepository.GetByNameAsync's own regression-test comment: an unescaped '%'/'_' in the
    // searched term gets treated as a SQL wildcard under ILike, causing false-positive matches).
    public async Task<(IReadOnlyList<ErrorRecord> Items, int TotalCount)> QueryAsync(ErrorListQuery query, CancellationToken cancellationToken = default)
    {
        var filtered = db.ErrorRecords.AsNoTracking().AsQueryable();

        // Code-review patch: the default exclude-Archived clause must not run when the caller
        // explicitly asked for Status = Archived -- IncludeArchived and Status are independent
        // controls in the UI, and applying both unconditionally previously produced
        // "Status != Archived AND Status == Archived", always zero rows.
        if (!query.IncludeArchived && query.Status != ErrorStatus.Archived)
            filtered = filtered.Where(r => r.Status != ErrorStatus.Archived);

        if (query.Category is not null)
            filtered = filtered.Where(r => r.Category == query.Category);

        if (query.Priority is not null)
            filtered = filtered.Where(r => r.Priority == query.Priority);

        if (query.Status is not null)
            filtered = filtered.Where(r => r.Status == query.Status);

        if (query.Source is not null)
            filtered = filtered.Where(r => r.Source == query.Source);

        // Story 4.7/AC #2: exact equality, not Contains/ILike -- the one filter in this feature
        // that must not be a partial match. Code-review patch: trimmed -- a value with incidental
        // leading/trailing whitespace should still match (the frontend's own input already
        // trims, but this repository is the authoritative filter layer for any caller).
        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
        {
            var correlationId = query.CorrelationId.Trim();
            filtered = filtered.Where(r => r.CorrelationId == correlationId);
        }

        if (query.FromDate is not null)
            filtered = filtered.Where(r => r.LastOccurredAt >= query.FromDate);

        if (query.ToDate is not null)
            filtered = filtered.Where(r => r.LastOccurredAt <= query.ToDate);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.ToLower();
            filtered = filtered.Where(r =>
                r.Message.ToLower().Contains(search) ||
                (r.ExceptionType != null && r.ExceptionType.ToLower().Contains(search)));
        }

        var totalCount = await filtered.CountAsync(cancellationToken);

        // Code-review patch: Page/PageSize are unvalidated caller input -- clamp before they
        // reach Skip()/Take() instead of trusting them (a non-positive Page previously risked a
        // negative Skip() argument; PageSize had no upper bound at all).
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize <= 0 ? 1 : query.PageSize, 1, MaxPageSize);

        var items = await filtered
            // Code-review patch: Id as a stable tie-breaker -- Skip/Take pagination is only
            // stable across separate requests with a fully deterministic sort; rows sharing the
            // exact same LastOccurredAt could otherwise be duplicated across pages or dropped.
            .OrderByDescending(r => r.LastOccurredAt)
            .ThenByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<ErrorRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ErrorRecord>> GetPurgeCandidatesAsync(DateTimeOffset cutoffDate, CancellationToken cancellationToken = default) =>
        await db.ErrorRecords
            .Where(r =>
                (r.Status == ErrorStatus.Resolved && r.ResolvedAt != null && r.ResolvedAt < cutoffDate) ||
                (r.Status == ErrorStatus.Archived && r.ArchivedAt != null && r.ArchivedAt < cutoffDate))
            .ToListAsync(cancellationToken);

    public void RemoveRange(IEnumerable<ErrorRecord> records) => db.ErrorRecords.RemoveRange(records);

    public void Remove(ErrorRecord record) => db.ErrorRecords.Remove(record);
}
