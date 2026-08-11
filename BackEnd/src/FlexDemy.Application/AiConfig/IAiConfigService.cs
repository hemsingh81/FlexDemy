namespace FlexDemy.Application.AiConfig;

public interface IAiConfigService
{
    Task<IReadOnlyList<AiTaskConfigDto>> GetAllTaskConfigsAsync(CancellationToken cancellationToken = default);

    // Single-task lookup -- lets a caller (Story 1.6's IAiTaskGateway) resolve one task's config
    // without fetching all 7 rows via GetAllTaskConfigsAsync on every call.
    Task<AiTaskConfigDto> GetTaskConfigAsync(string taskId, CancellationToken cancellationToken = default);

    Task<AiTaskConfigDto> UpdateTaskConfigAsync(string taskId, UpdateAiTaskConfigRequest request, CancellationToken cancellationToken = default);
}
