using FlexDemy.Domain.AiConfig;

namespace FlexDemy.Application.AiConfig;

public interface IAiTaskConfigRepository
{
    Task<List<AiTaskConfig>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<AiTaskConfig?> GetByTaskIdAsync(string taskId, CancellationToken cancellationToken = default);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    void Update(AiTaskConfig entity);
}
