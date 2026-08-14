using FlexDemy.Application.AiUsage;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class AiTaskUsageRepository(FlexDemyDbContext db) : IAiTaskUsageRepository
{
    public void Add(AiTaskUsage usage) => db.AiTaskUsages.Add(usage);

    public Task<List<AiTaskUsage>> GetSinceAsync(DateTimeOffset? cutoffUtc, CancellationToken cancellationToken = default) =>
        db.AiTaskUsages
            .AsNoTracking()
            .Where(u => cutoffUtc == null || u.CreatedAt >= cutoffUtc)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(cancellationToken);
}
