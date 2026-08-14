namespace FlexDemy.Application.AiGateway;

// AD-14: one fat interface, not per-task interfaces -- one method per AI Task. Feature code
// calls this and never a vendor SDK directly (FR-1). Implemented by
// FlexDemy.Infrastructure.AiGateway.PortkeyAiGateway.
public interface IAiGateway
{
    Task<AiGatewayResponse> DefineKeywordAsync(AiGatewayRequest request, CancellationToken cancellationToken = default);

    Task<AiEmbeddingResponse> GenerateEmbeddingAsync(AiEmbeddingRequest request, CancellationToken cancellationToken = default);
}
