using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FlexDemy.Infrastructure.AiGateway;

// AD-14: HTTP-calling implementation of IAiGateway, targeting a self-hosted Portkey OSS gateway
// with an OpenAI-compatible request/response shape. Registered via the typed-client pattern in
// DependencyInjection.cs (Task 3) -- httpClient.BaseAddress is set there from AiGatewayOptions.
//
// This class is transport only: Provider/Model come from the caller (AiGatewayRequest), never
// resolved here from a config store (that's Story 1.5's IAiConfigService, layered above this).
// See Story 1.4's Dev Notes for the full reasoning.
public sealed class PortkeyAiGateway(HttpClient httpClient, IOptions<AiGatewayOptions> options, ILogger<PortkeyAiGateway> logger) : IAiGateway
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public Task<AiGatewayResponse> ExtractStructureAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public Task<AiGatewayResponse> ExplainTopicAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public Task<AiGatewayResponse> RewriteExplanationAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public Task<AiGatewayResponse> GenerateExerciseAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public Task<AiGatewayResponse> DefineKeywordAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public Task<AiGatewayResponse> DescribeNotationAsync(AiGatewayRequest request, CancellationToken cancellationToken = default) =>
        SendChatCompletionAsync(request, cancellationToken);

    public async Task<AiEmbeddingResponse> GenerateEmbeddingAsync(AiEmbeddingRequest request, CancellationToken cancellationToken = default)
    {
        ValidateEmbeddingRequest(request);
        var apiKey = ResolveApiKey(request.Provider);
        var body = new PortkeyEmbeddingRequestBody(request.Model, request.Input);

        using var httpRequest = BuildRequest("/v1/embeddings", request.Provider, apiKey, body);
        var responseBody = await SendAndReadAsync(httpRequest, cancellationToken);
        var parsed = Deserialize<PortkeyEmbeddingResponseBody>(responseBody);

        var embeddings = (parsed.Data ?? []).Select(d => d.Embedding ?? (IReadOnlyList<float>)[]).ToList();
        return new AiEmbeddingResponse(embeddings, request.Provider, request.Model, ToUsage(parsed.Usage));
    }

    private async Task<AiGatewayResponse> SendChatCompletionAsync(AiGatewayRequest request, CancellationToken cancellationToken)
    {
        ValidateChatRequest(request);
        var apiKey = ResolveApiKey(request.Provider);
        var body = new PortkeyChatRequestBody(
            request.Model,
            request.Messages.Select(m => new PortkeyChatMessage(m.Role, m.Content)).ToList(),
            request.Temperature,
            request.MaxTokens);

        using var httpRequest = BuildRequest("/v1/chat/completions", request.Provider, apiKey, body);
        var responseBody = await SendAndReadAsync(httpRequest, cancellationToken);
        var parsed = Deserialize<PortkeyChatResponseBody>(responseBody);

        var content = parsed.Choices is { Count: > 0 } ? parsed.Choices[0].Message?.Content ?? string.Empty : string.Empty;
        return new AiGatewayResponse(content, request.Provider, request.Model, ToUsage(parsed.Usage));
    }

    // Defensive validation for a public cross-cutting API surface with no callers yet (Stories
    // 1.5/1.6 are the first). Guards against null Provider/Model/Messages surfacing as an
    // unhandled ArgumentNullException/NullReferenceException instead of AiGatewayException.
    private static void ValidateChatRequest(AiGatewayRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Provider))
        {
            throw new AiGatewayException("AiGatewayRequest.Provider is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new AiGatewayException("AiGatewayRequest.Model is required.");
        }

        if (request.Messages is not { Count: > 0 })
        {
            throw new AiGatewayException("AiGatewayRequest.Messages must be non-empty.");
        }
    }

    private static void ValidateEmbeddingRequest(AiEmbeddingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Provider))
        {
            throw new AiGatewayException("AiEmbeddingRequest.Provider is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new AiGatewayException("AiEmbeddingRequest.Model is required.");
        }

        if (request.Input is not { Count: > 0 })
        {
            throw new AiGatewayException("AiEmbeddingRequest.Input must be non-empty.");
        }
    }

    private string ResolveApiKey(string provider)
    {
        if (!options.Value.ProviderApiKeys.TryGetValue(provider, out var apiKey) || string.IsNullOrWhiteSpace(apiKey))
        {
            throw new AiGatewayException($"No API key configured for AI provider '{provider}'.");
        }

        return apiKey;
    }

    // Header assignment can throw FormatException for a value containing characters invalid in
    // an HTTP header -- wrapped here (not just inside SendAndReadAsync's try) so every
    // gateway-related failure surfaces as AiGatewayException, per AC #5.
    private static HttpRequestMessage BuildRequest<TBody>(string path, string provider, string apiKey, TBody body)
    {
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json"),
        };

        try
        {
            httpRequest.Headers.Add("x-portkey-provider", provider);
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }
        catch (FormatException ex)
        {
            httpRequest.Dispose();
            throw new AiGatewayException($"Invalid AI gateway request headers: {ex.Message}");
        }

        return httpRequest;
    }

    // A raw HttpRequestException/TaskCanceledException escaping to a controller would hit
    // ExceptionHandlingMiddleware's unmatched-type fallback (500, "Unexpected Error") instead of
    // AC #5's 502 -- everything gateway-related surfaces as AiGatewayException instead. A
    // TaskCanceledException caused by the CALLER's own cancellationToken (not a request timeout)
    // is left to propagate normally -- that's cooperative cancellation, not a gateway failure.
    //
    // On a non-success status, the raw response body is logged server-side only, never placed in
    // the AiGatewayException message -- that message flows straight into the client-facing
    // ProblemDetails.Detail (ExceptionHandlingMiddleware), and upstream/provider error bodies are
    // uncontrolled third-party content, unlike every other AppException subtype's first-party
    // message text. A real info-disclosure risk if left verbatim in a client-visible field.
    private async Task<string> SendAndReadAsync(HttpRequestMessage httpRequest, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(httpRequest, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new AiGatewayException($"AI gateway request failed: {ex.Message}");
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AiGatewayException($"AI gateway request timed out: {ex.Message}");
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "AI gateway request failed with status {StatusCode}: {ResponseBody}",
                    (int)response.StatusCode,
                    body);
                throw new AiGatewayException($"AI gateway request failed with status {(int)response.StatusCode}.");
            }

            return body;
        }
    }

    // Guards against a malformed/incomplete 200-OK body (missing/invalid JSON) surfacing as an
    // unhandled JsonException instead of AiGatewayException -- AC #5 requires every gateway
    // failure, not just non-success statuses, to surface this way.
    private static T Deserialize<T>(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions)
                ?? throw new AiGatewayException("AI gateway returned an empty or invalid response.");
        }
        catch (JsonException ex)
        {
            throw new AiGatewayException($"AI gateway returned an unparseable response: {ex.Message}");
        }
    }

    // usage is nullable at the wire level even though PortkeyUsage's own properties aren't --
    // some gateway responses omit "usage" entirely (e.g. a malformed or partial reply).
    private static AiGatewayUsage ToUsage(PortkeyUsage? usage) =>
        usage is null ? new AiGatewayUsage(0, 0, 0) : new AiGatewayUsage(usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens);

    // Internal wire-shape DTOs -- OpenAI-compatible JSON, kept separate from the public
    // Application-layer records (AiGatewayModels.cs) so a Portkey/OpenAI field-naming quirk
    // never leaks past this class. Nested reference-typed properties are nullable: System.Text.Json
    // assigns null for a missing JSON property at runtime regardless of C# nullable annotations,
    // so this class treats them as genuinely optional and null-guards every read (see Deserialize/
    // ToUsage/SendChatCompletionAsync/GenerateEmbeddingAsync above).
    private sealed record PortkeyChatMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed record PortkeyChatRequestBody(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("messages")] IReadOnlyList<PortkeyChatMessage> Messages,
        [property: JsonPropertyName("temperature")] double? Temperature,
        [property: JsonPropertyName("max_tokens")] int? MaxTokens);

    private sealed record PortkeyUsage(
        [property: JsonPropertyName("prompt_tokens")] int PromptTokens,
        [property: JsonPropertyName("completion_tokens")] int CompletionTokens,
        [property: JsonPropertyName("total_tokens")] int TotalTokens);

    private sealed record PortkeyChatChoiceMessage([property: JsonPropertyName("content")] string? Content);

    private sealed record PortkeyChatChoice([property: JsonPropertyName("message")] PortkeyChatChoiceMessage? Message);

    private sealed record PortkeyChatResponseBody(
        [property: JsonPropertyName("choices")] IReadOnlyList<PortkeyChatChoice>? Choices,
        [property: JsonPropertyName("usage")] PortkeyUsage? Usage);

    private sealed record PortkeyEmbeddingRequestBody(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("input")] IReadOnlyList<string> Input);

    private sealed record PortkeyEmbeddingDatum([property: JsonPropertyName("embedding")] IReadOnlyList<float>? Embedding);

    private sealed record PortkeyEmbeddingResponseBody(
        [property: JsonPropertyName("data")] IReadOnlyList<PortkeyEmbeddingDatum>? Data,
        [property: JsonPropertyName("usage")] PortkeyUsage? Usage);
}
