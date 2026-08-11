namespace FlexDemy.Application.AiGateway;

// OpenAI-compatible chat message shape (AD-14). Role is "system" | "user" | "assistant".
public sealed record AiGatewayMessage(string Role, string Content);

// Provider/Model are caller-supplied, not resolved internally from a config store -- IAiGateway
// is a pure transport abstraction. Story 1.5 (AiTaskConfig) resolves per-task provider/model;
// Story 1.6 (Polly fallback) decides primary vs. secondary and retries with a different request.
// See Story 1.4's Dev Notes for the full reasoning.
public sealed record AiGatewayRequest(
    string Provider,
    string Model,
    IReadOnlyList<AiGatewayMessage> Messages,
    double? Temperature = null,
    int? MaxTokens = null);

public sealed record AiGatewayUsage(int PromptTokens, int CompletionTokens, int TotalTokens);

// Provider/Model are echoed back (not just present on the request) so a caller -- e.g. Story
// 1.6/1.7's fallback + usage-tracking wrapper -- can tell which provider actually served the
// call, which may differ from the one requested if the gateway itself substitutes a route.
public sealed record AiGatewayResponse(string Content, string Provider, string Model, AiGatewayUsage Usage);

public sealed record AiEmbeddingRequest(string Provider, string Model, IReadOnlyList<string> Input);

public sealed record AiEmbeddingResponse(
    IReadOnlyList<IReadOnlyList<float>> Embeddings,
    string Provider,
    string Model,
    AiGatewayUsage Usage);
