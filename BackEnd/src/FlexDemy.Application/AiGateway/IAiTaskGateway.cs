namespace FlexDemy.Application.AiGateway;

// AD-14 (Story 1.6): the entry point a feature (Epic 2/3's extractStructure/explainTopic/etc.
// implementations) calls -- never IAiGateway directly. One method per AI Task, mirroring
// IAiGateway's shape but without Provider/Model (resolved internally from AiTaskConfig, with
// fallback-on-failure via Polly). Implemented by FlexDemy.Application.AiGateway.AiTaskGateway.
public interface IAiTaskGateway
{
    Task<AiTaskResult> DefineKeywordAsync(AiTaskRequest request, CancellationToken cancellationToken = default);

    Task<AiTaskEmbeddingResult> GenerateEmbeddingAsync(
        IReadOnlyList<string> input, string? courseId = null, string? tutorId = null, CancellationToken cancellationToken = default);
}
