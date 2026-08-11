using FlexDemy.Domain.AiUsage;

namespace FlexDemy.Application.AiUsage;

public interface IAiTaskUsageRepository
{
    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    void Add(AiTaskUsage usage);

    // cutoffUtc == null -> no lower bound (the "all" date range); otherwise filters
    // CreatedAt >= cutoffUtc server-side, ordered ascending by CreatedAt.
    Task<List<AiTaskUsage>> GetSinceAsync(DateTimeOffset? cutoffUtc, CancellationToken cancellationToken = default);
}
