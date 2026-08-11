using FlexDemy.Application.AiConfig;
using FlexDemy.Domain.AiConfig;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class AiTaskConfigRepository(FlexDemyDbContext db) : IAiTaskConfigRepository
{
    public Task<List<AiTaskConfig>> GetAllAsync(CancellationToken cancellationToken = default) =>
        db.AiTaskConfigs.ToListAsync(cancellationToken);

    public Task<AiTaskConfig?> GetByTaskIdAsync(string taskId, CancellationToken cancellationToken = default) =>
        db.AiTaskConfigs.FirstOrDefaultAsync(c => c.TaskId == taskId, cancellationToken);

    public void Update(AiTaskConfig entity) => db.AiTaskConfigs.Update(entity);
}
