namespace FlexDemy.Application.AiGateway;

// Story 1.6: the request/result shapes for IAiTaskGateway -- deliberately narrower than
// AiGatewayRequest/AiGatewayResponse (Story 1.4). No Provider/Model here: IAiTaskGateway resolves
// those internally per-task from AiTaskConfig (via IAiConfigService), including fallback.
// CourseId/TutorId (Story 1.7): optional attribution for usage recording -- "where applicable"
// per FR-4. No Epic 1 caller supplies real course/tutor context yet; these exist for whichever
// Epic 2/3 story becomes the first real IAiTaskGateway caller.
public sealed record AiTaskRequest(
    IReadOnlyList<AiGatewayMessage> Messages,
    double? Temperature = null,
    int? MaxTokens = null,
    string? CourseId = null,
    string? TutorId = null);

// IsFallbackServed: true if the primary provider failed and this result came from the task's
// configured fallback instead. "Admin visibility" in the UI sense is Story 1.7's job (once
// AiTaskUsage exists to persist this against a real usage record) -- this story only produces
// the flag and logs it. See Story 1.6 Dev Notes.
public sealed record AiTaskResult(string Content, string Provider, string Model, AiGatewayUsage Usage, bool IsFallbackServed);

public sealed record AiTaskEmbeddingResult(
    IReadOnlyList<IReadOnlyList<float>> Embeddings,
    string Provider,
    string Model,
    AiGatewayUsage Usage,
    bool IsFallbackServed);
