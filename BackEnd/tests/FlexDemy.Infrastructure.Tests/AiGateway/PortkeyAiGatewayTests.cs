using System.Net;
using System.Text;
using System.Text.Json;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Infrastructure.AiGateway;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace FlexDemy.Infrastructure.Tests.AiGateway;

// HttpMessageHandler.SendAsync is protected -- NSubstitute can't substitute it directly, and
// Moq is disallowed (AD-7). A small hand-rolled fake is the standard .NET pattern regardless of
// mocking library.
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly HttpStatusCode _statusCode;
    private readonly string? _responseBody;
    private readonly Exception? _throws;

    public HttpRequestMessage? LastRequest { get; private set; }
    public string? LastRequestBody { get; private set; }

    public FakeHttpMessageHandler(HttpStatusCode statusCode, string? responseBody)
    {
        _statusCode = statusCode;
        _responseBody = responseBody;
    }

    public FakeHttpMessageHandler(Exception throws)
    {
        _throws = throws;
        _statusCode = HttpStatusCode.OK;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        LastRequest = request;
        LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);

        if (_throws is not null)
        {
            throw _throws;
        }

        return new HttpResponseMessage(_statusCode)
        {
            Content = _responseBody is null ? null : new StringContent(_responseBody, Encoding.UTF8, "application/json"),
        };
    }
}

public class PortkeyAiGatewayTests
{
    private const string SuccessfulChatResponse = """
        {
          "choices": [{ "message": { "role": "assistant", "content": "Generated text" } }],
          "usage": { "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15 }
        }
        """;

    private const string SuccessfulEmbeddingResponse = """
        {
          "data": [{ "embedding": [0.1, 0.2, 0.3] }],
          "usage": { "prompt_tokens": 3, "completion_tokens": 0, "total_tokens": 3 }
        }
        """;

    private static PortkeyAiGateway CreateSut(FakeHttpMessageHandler handler, Dictionary<string, string>? providerApiKeys = null)
    {
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://test-gateway:8787") };
        var options = Options.Create(new AiGatewayOptions
        {
            BaseUrl = "http://test-gateway:8787",
            ProviderApiKeys = providerApiKeys ?? new Dictionary<string, string> { ["groq"] = "test-groq-key" },
        });
        return new PortkeyAiGateway(client, options, NullLogger<PortkeyAiGateway>.Instance);
    }

    private static AiGatewayRequest ChatRequest() => new(
        Provider: "groq",
        Model: "llama-3.1-8b",
        Messages: [new AiGatewayMessage("user", "Explain photosynthesis")],
        Temperature: 0.7,
        MaxTokens: 500);

    [Fact]
    public async Task ExplainTopicAsync_sends_portkey_provider_and_bearer_auth_headers()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        await sut.ExplainTopicAsync(ChatRequest());

        Assert.NotNull(handler.LastRequest);
        Assert.Equal("groq", handler.LastRequest!.Headers.GetValues("x-portkey-provider").Single());
        Assert.Equal("Bearer test-groq-key", handler.LastRequest.Headers.Authorization!.ToString());
        Assert.Equal("/v1/chat/completions", handler.LastRequest.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task ExplainTopicAsync_sends_correctly_shaped_openai_compatible_body()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        await sut.ExplainTopicAsync(ChatRequest());

        Assert.NotNull(handler.LastRequestBody);
        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        var root = doc.RootElement;
        Assert.Equal("llama-3.1-8b", root.GetProperty("model").GetString());
        Assert.Equal(0.7, root.GetProperty("temperature").GetDouble());
        Assert.Equal(500, root.GetProperty("max_tokens").GetInt32());
        var messages = root.GetProperty("messages");
        Assert.Equal(1, messages.GetArrayLength());
        Assert.Equal("user", messages[0].GetProperty("role").GetString());
        Assert.Equal("Explain photosynthesis", messages[0].GetProperty("content").GetString());
    }

    [Fact]
    public async Task ExplainTopicAsync_maps_a_successful_response_to_AiGatewayResponse()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        var result = await sut.ExplainTopicAsync(ChatRequest());

        Assert.Equal("Generated text", result.Content);
        Assert.Equal("groq", result.Provider);
        Assert.Equal("llama-3.1-8b", result.Model);
        Assert.Equal(10, result.Usage.PromptTokens);
        Assert.Equal(5, result.Usage.CompletionTokens);
        Assert.Equal(15, result.Usage.TotalTokens);
    }

    [Theory]
    [InlineData(nameof(PortkeyAiGateway.ExtractStructureAsync))]
    [InlineData(nameof(PortkeyAiGateway.ExplainTopicAsync))]
    [InlineData(nameof(PortkeyAiGateway.RewriteExplanationAsync))]
    [InlineData(nameof(PortkeyAiGateway.GenerateExerciseAsync))]
    [InlineData(nameof(PortkeyAiGateway.DefineKeywordAsync))]
    [InlineData(nameof(PortkeyAiGateway.DescribeNotationAsync))]
    public async Task every_chat_style_method_posts_to_chat_completions(string methodName)
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        Task<AiGatewayResponse> Invoke() => methodName switch
        {
            nameof(PortkeyAiGateway.ExtractStructureAsync) => sut.ExtractStructureAsync(ChatRequest()),
            nameof(PortkeyAiGateway.ExplainTopicAsync) => sut.ExplainTopicAsync(ChatRequest()),
            nameof(PortkeyAiGateway.RewriteExplanationAsync) => sut.RewriteExplanationAsync(ChatRequest()),
            nameof(PortkeyAiGateway.GenerateExerciseAsync) => sut.GenerateExerciseAsync(ChatRequest()),
            nameof(PortkeyAiGateway.DefineKeywordAsync) => sut.DefineKeywordAsync(ChatRequest()),
            nameof(PortkeyAiGateway.DescribeNotationAsync) => sut.DescribeNotationAsync(ChatRequest()),
            _ => throw new InvalidOperationException(),
        };

        await Invoke();

        Assert.Equal("/v1/chat/completions", handler.LastRequest!.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task a_non_success_status_code_throws_AiGatewayException()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.InternalServerError, "{\"error\":\"upstream failure\"}");
        var sut = CreateSut(handler);

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest()));
    }

    [Fact]
    public async Task a_network_failure_throws_AiGatewayException_not_HttpRequestException()
    {
        var handler = new FakeHttpMessageHandler(new HttpRequestException("connection refused"));
        var sut = CreateSut(handler);

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest()));
    }

    [Fact]
    public async Task a_provider_with_no_configured_api_key_throws_AiGatewayException_before_sending_a_request()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler, providerApiKeys: new Dictionary<string, string>());

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest()));
        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_posts_to_embeddings_endpoint_with_correct_shape_and_maps_response()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulEmbeddingResponse);
        var sut = CreateSut(handler);

        var result = await sut.GenerateEmbeddingAsync(new AiEmbeddingRequest("groq", "embed-model", ["hello world"]));

        Assert.Equal("/v1/embeddings", handler.LastRequest!.RequestUri!.AbsolutePath);
        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.Equal("embed-model", doc.RootElement.GetProperty("model").GetString());
        Assert.Equal("hello world", doc.RootElement.GetProperty("input")[0].GetString());

        Assert.Single(result.Embeddings);
        Assert.Equal([0.1f, 0.2f, 0.3f], result.Embeddings[0]);
        Assert.Equal(3, result.Usage.TotalTokens);
    }

    [Fact]
    public async Task malformed_json_in_a_200_response_throws_AiGatewayException_not_JsonException()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, "{not valid json");
        var sut = CreateSut(handler);

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest()));
    }

    [Fact]
    public async Task a_response_missing_usage_maps_to_zero_usage_instead_of_throwing()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, """{ "choices": [{ "message": { "content": "hi" } }] }""");
        var sut = CreateSut(handler);

        var result = await sut.ExplainTopicAsync(ChatRequest());

        Assert.Equal("hi", result.Content);
        Assert.Equal(0, result.Usage.TotalTokens);
    }

    [Fact]
    public async Task a_response_missing_choices_maps_to_empty_content_instead_of_throwing()
    {
        var handler = new FakeHttpMessageHandler(
            HttpStatusCode.OK,
            """{ "usage": { "prompt_tokens": 1, "completion_tokens": 0, "total_tokens": 1 } }""");
        var sut = CreateSut(handler);

        var result = await sut.ExplainTopicAsync(ChatRequest());

        Assert.Equal(string.Empty, result.Content);
    }

    [Fact]
    public async Task a_response_missing_data_for_embeddings_maps_to_empty_list_instead_of_throwing()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, """{ "usage": { "prompt_tokens": 1, "completion_tokens": 0, "total_tokens": 1 } }""");
        var sut = CreateSut(handler);

        var result = await sut.GenerateEmbeddingAsync(new AiEmbeddingRequest("groq", "embed-model", ["hello"]));

        Assert.Empty(result.Embeddings);
    }

    [Fact]
    public async Task the_exception_message_for_a_non_success_status_does_not_contain_the_raw_response_body()
    {
        const string sensitiveBody = "{\"error\":\"upstream failure with secret-token-abc123\"}";
        var handler = new FakeHttpMessageHandler(HttpStatusCode.InternalServerError, sensitiveBody);
        var sut = CreateSut(handler);

        var ex = await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest()));

        Assert.DoesNotContain("secret-token-abc123", ex.Message);
        Assert.Contains("500", ex.Message);
    }

    [Fact]
    public async Task provider_lookup_is_case_insensitive()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://test-gateway:8787") };
        var aiGatewayOptions = new AiGatewayOptions { BaseUrl = "http://test-gateway:8787" };
        aiGatewayOptions.ProviderApiKeys["groq"] = "test-groq-key";
        var sut = new PortkeyAiGateway(client, Options.Create(aiGatewayOptions), NullLogger<PortkeyAiGateway>.Instance);

        await sut.ExplainTopicAsync(ChatRequest() with { Provider = "GROQ" });

        Assert.NotNull(handler.LastRequest);
        Assert.Equal("GROQ", handler.LastRequest!.Headers.GetValues("x-portkey-provider").Single());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public async Task a_blank_provider_throws_AiGatewayException_before_sending_a_request(string? provider)
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest() with { Provider = provider! }));
        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task empty_messages_throws_AiGatewayException_before_sending_a_request()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        await Assert.ThrowsAsync<AiGatewayException>(() => sut.ExplainTopicAsync(ChatRequest() with { Messages = [] }));
        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task omitted_temperature_and_max_tokens_are_not_serialized_as_json_null()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, SuccessfulChatResponse);
        var sut = CreateSut(handler);

        await sut.ExplainTopicAsync(ChatRequest() with { Temperature = null, MaxTokens = null });

        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.False(doc.RootElement.TryGetProperty("temperature", out _));
        Assert.False(doc.RootElement.TryGetProperty("max_tokens", out _));
    }
}
