using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AiGateway;

public class AiTaskGatewayTests
{
    private static AiTaskConfigDto MakeConfig(string taskId = AiTaskIds.DefineKeyword) => new(
        taskId, "Groq", "llama-4-maverick", "OpenRouter", "claude-4-haiku", 80m, CurrentSpend: 0m,
        PricePerMillionInputTokens: 0m, PricePerMillionOutputTokens: 0m,
        FallbackPricePerMillionInputTokens: 0m, FallbackPricePerMillionOutputTokens: 0m);

    private static AiGatewayResponse PrimaryResponse() =>
        new("primary content", "Groq", "llama-4-maverick", new AiGatewayUsage(10, 5, 15));

    private static AiGatewayResponse FallbackResponse() =>
        new("fallback content", "OpenRouter", "claude-4-haiku", new AiGatewayUsage(10, 5, 15));

    private static AiTaskRequest Request() => new([new AiGatewayMessage("user", "hi")]);

    [Fact]
    public async Task DefineKeywordAsync_threads_distinct_courseId_and_tutorId_through_to_RecordUsageAsync_without_swapping_them()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>()).Returns(PrimaryResponse());
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);
        // Deliberately distinct, order-sensitive values -- a swapped courseId/tutorId argument
        // order at the AiTaskGateway call site would compile and pass every other test (which all
        // use null/null via Request()), but must fail this one (review finding, 2026-08-11).
        var request = new AiTaskRequest([new AiGatewayMessage("user", "hi")], CourseId: "course_42", TutorId: "tutor_7");

        await sut.DefineKeywordAsync(request);

        await usageService.Received(1).RecordUsageAsync(
            AiTaskIds.DefineKeyword, "Groq", "llama-4-maverick", Arg.Any<AiGatewayUsage>(), false, "course_42", "tutor_7", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_threads_distinct_courseId_and_tutorId_through_to_RecordUsageAsync_without_swapping_them()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.Embeddings, Arg.Any<CancellationToken>())
            .Returns(new AiTaskConfigDto(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m, 0m, 0m, 0m, 0m, 0m));
        var gateway = Substitute.For<IAiGateway>();
        gateway.GenerateEmbeddingAsync(Arg.Any<AiEmbeddingRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiEmbeddingResponse([[0.1f, 0.2f]], "Local", "nomic-embed-text", new AiGatewayUsage(3, 0, 3)));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await sut.GenerateEmbeddingAsync(["hello"], courseId: "course_42", tutorId: "tutor_7");

        await usageService.Received(1).RecordUsageAsync(
            AiTaskIds.Embeddings, "Local", "nomic-embed-text", Arg.Any<AiGatewayUsage>(), false, "course_42", "tutor_7", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineKeywordAsync_primary_succeeds_never_calls_fallback()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Is<AiGatewayRequest>(r => r.Provider == "Groq"), Arg.Any<CancellationToken>()).Returns(PrimaryResponse());
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var result = await sut.DefineKeywordAsync(Request());

        Assert.Equal("primary content", result.Content);
        Assert.Equal("Groq", result.Provider);
        Assert.False(result.IsFallbackServed);
        await gateway.DidNotReceive().DefineKeywordAsync(Arg.Is<AiGatewayRequest>(r => r.Provider == "OpenRouter"), Arg.Any<CancellationToken>());
        await usageService.Received(1).RecordUsageAsync(
            AiTaskIds.DefineKeyword, "Groq", "llama-4-maverick", Arg.Any<AiGatewayUsage>(), false, null, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineKeywordAsync_both_primary_and_fallback_fail_throws_AiTaskUnavailableException()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiGatewayResponse>(new AiGatewayException("unavailable")));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var ex = await Assert.ThrowsAsync<AiTaskUnavailableException>(() => sut.DefineKeywordAsync(Request()));

        Assert.IsType<AiGatewayException>(ex.InnerException);
        await usageService.DidNotReceive().RecordUsageAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiGatewayUsage>(), Arg.Any<bool>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineKeywordAsync_a_non_AiGatewayException_from_the_primary_propagates_without_attempting_fallback()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiGatewayResponse>(new InvalidOperationException("bug")));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.DefineKeywordAsync(Request()));
        await gateway.Received(1).DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>());
        // A non-AiGatewayException failure still leaves the pre-flight reservation outstanding --
        // it must be released just like an AiTaskUnavailableException, not leaked (review finding,
        // 2026-08-11: the catch used to be narrowed to AiTaskUnavailableException only).
        await budgetService.Received(1).ReleaseReservationAsync(AiTaskIds.DefineKeyword, Arg.Any<decimal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineKeywordAsync_primary_fails_falls_back_to_the_configured_secondary()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig(AiTaskIds.DefineKeyword));
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Is<AiGatewayRequest>(r => r.Provider == "Groq"), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiGatewayResponse>(new AiGatewayException("rate limited")));
        gateway.DefineKeywordAsync(Arg.Is<AiGatewayRequest>(r => r.Provider == "OpenRouter"), Arg.Any<CancellationToken>())
            .Returns(FallbackResponse());
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var result = await sut.DefineKeywordAsync(Request());

        Assert.True(result.IsFallbackServed);
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_primary_succeeds_never_calls_fallback()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.Embeddings, Arg.Any<CancellationToken>())
            .Returns(new AiTaskConfigDto(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m, 0m, 0m, 0m, 0m, 0m));
        var gateway = Substitute.For<IAiGateway>();
        gateway.GenerateEmbeddingAsync(Arg.Is<AiEmbeddingRequest>(r => r.Provider == "Local"), Arg.Any<CancellationToken>())
            .Returns(new AiEmbeddingResponse([[0.1f, 0.2f]], "Local", "nomic-embed-text", new AiGatewayUsage(3, 0, 3)));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var result = await sut.GenerateEmbeddingAsync(["hello"]);

        Assert.False(result.IsFallbackServed);
        Assert.Equal("Local", result.Provider);
        await usageService.Received(1).RecordUsageAsync(
            AiTaskIds.Embeddings, "Local", "nomic-embed-text", Arg.Any<AiGatewayUsage>(), false, null, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_primary_fails_falls_back_to_the_configured_secondary()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.Embeddings, Arg.Any<CancellationToken>())
            .Returns(new AiTaskConfigDto(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m, 0m, 0m, 0m, 0m, 0m));
        var gateway = Substitute.For<IAiGateway>();
        gateway.GenerateEmbeddingAsync(Arg.Is<AiEmbeddingRequest>(r => r.Provider == "Local"), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiEmbeddingResponse>(new AiGatewayException("unavailable")));
        gateway.GenerateEmbeddingAsync(Arg.Is<AiEmbeddingRequest>(r => r.Provider == "OpenRouter"), Arg.Any<CancellationToken>())
            .Returns(new AiEmbeddingResponse([[0.3f, 0.4f]], "OpenRouter", "text-embedding-3-small", new AiGatewayUsage(3, 0, 3)));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var result = await sut.GenerateEmbeddingAsync(["hello"]);

        Assert.True(result.IsFallbackServed);
        Assert.Equal("OpenRouter", result.Provider);
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_both_primary_and_fallback_fail_throws_AiTaskUnavailableException()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.Embeddings, Arg.Any<CancellationToken>())
            .Returns(new AiTaskConfigDto(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m, 0m, 0m, 0m, 0m, 0m));
        var gateway = Substitute.For<IAiGateway>();
        gateway.GenerateEmbeddingAsync(Arg.Any<AiEmbeddingRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiEmbeddingResponse>(new AiGatewayException("unavailable")));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var ex = await Assert.ThrowsAsync<AiTaskUnavailableException>(() => sut.GenerateEmbeddingAsync(["hello"]));

        Assert.IsType<AiGatewayException>(ex.InnerException);
        await usageService.DidNotReceive().RecordUsageAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiGatewayUsage>(), Arg.Any<bool>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DefineKeywordAsync_a_RecordUsageAsync_failure_does_not_fail_the_call()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Is<AiGatewayRequest>(r => r.Provider == "Groq"), Arg.Any<CancellationToken>()).Returns(PrimaryResponse());
        var usageService = Substitute.For<IAiUsageService>();
        usageService.RecordUsageAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiGatewayUsage>(), Arg.Any<bool>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<decimal>(new InvalidOperationException("DB write failed")));
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        var result = await sut.DefineKeywordAsync(Request());

        Assert.Equal("primary content", result.Content);
        // The real cost is unknown (recording failed), so the full estimate must be released, not settled.
        await budgetService.Received(1).ReleaseReservationAsync(AiTaskIds.DefineKeyword, Arg.Any<decimal>(), Arg.Any<CancellationToken>());
        await budgetService.DidNotReceiveWithAnyArgs().SettleAsync(default!, default, default, default);
    }

    [Fact]
    public async Task DefineKeywordAsync_budget_exceeded_throws_before_any_gateway_call_is_attempted()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(false);
        var usageService = Substitute.For<IAiUsageService>();
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await Assert.ThrowsAsync<AiTaskBudgetExceededException>(() => sut.DefineKeywordAsync(Request()));

        await gateway.DidNotReceiveWithAnyArgs().DefineKeywordAsync(default!, default);
    }

    [Fact]
    public async Task DefineKeywordAsync_the_reservation_estimate_prices_the_prompt_not_just_the_completion()
    {
        var configService = Substitute.For<IAiConfigService>();
        // Distinct, nonzero input/output rates so a prompt-inclusive estimate is provably
        // different from a completion-only one (review finding, 2026-08-11: the estimate used to
        // ignore prompt tokens entirely).
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(
            MakeConfig() with { PricePerMillionInputTokens = 100m, PricePerMillionOutputTokens = 0m });
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>()).Returns(PrimaryResponse());
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        var capturedEstimate = 0m;
        budgetService.TryReserveAsync(AiTaskIds.DefineKeyword, Arg.Do<decimal>(e => capturedEstimate = e), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);
        var longPromptRequest = new AiTaskRequest([new AiGatewayMessage("user", new string('a', 4000))], MaxTokens: 0);

        await sut.DefineKeywordAsync(longPromptRequest);

        // Output price is 0, so any nonzero estimate can only have come from pricing the prompt.
        Assert.True(capturedEstimate > 0m);
    }

    [Fact]
    public async Task DefineKeywordAsync_a_successful_call_settles_the_budget_with_the_estimated_and_actual_costs()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>()).Returns(PrimaryResponse());
        var usageService = Substitute.For<IAiUsageService>();
        usageService.RecordUsageAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiGatewayUsage>(), Arg.Any<bool>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(7.5m);
        var budgetService = Substitute.For<IAiBudgetService>();
        var capturedEstimate = 0m;
        budgetService.TryReserveAsync(AiTaskIds.DefineKeyword, Arg.Do<decimal>(e => capturedEstimate = e), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await sut.DefineKeywordAsync(Request());

        await budgetService.Received(1).SettleAsync(AiTaskIds.DefineKeyword, capturedEstimate, 7.5m, Arg.Any<CancellationToken>());
        await budgetService.DidNotReceiveWithAnyArgs().ReleaseReservationAsync(default!, default, default);
    }

    [Fact]
    public async Task DefineKeywordAsync_both_primary_and_fallback_fail_releases_the_full_reservation_and_still_propagates_the_original_exception()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var gateway = Substitute.For<IAiGateway>();
        gateway.DefineKeywordAsync(Arg.Any<AiGatewayRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiGatewayResponse>(new AiGatewayException("unavailable")));
        var usageService = Substitute.For<IAiUsageService>();
        var budgetService = Substitute.For<IAiBudgetService>();
        var capturedEstimate = 0m;
        budgetService.TryReserveAsync(AiTaskIds.DefineKeyword, Arg.Do<decimal>(e => capturedEstimate = e), Arg.Any<CancellationToken>()).Returns(true);
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await Assert.ThrowsAsync<AiTaskUnavailableException>(() => sut.DefineKeywordAsync(Request()));

        await budgetService.Received(1).ReleaseReservationAsync(AiTaskIds.DefineKeyword, capturedEstimate, Arg.Any<CancellationToken>());
        await usageService.DidNotReceiveWithAnyArgs().RecordUsageAsync(default!, default!, default!, default!, default, default, default, default);
    }

    [Fact]
    public async Task GenerateEmbeddingAsync_budget_exceeded_throws_before_any_gateway_call_is_attempted()
    {
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.Embeddings, Arg.Any<CancellationToken>())
            .Returns(new AiTaskConfigDto(AiTaskIds.Embeddings, "Local", "nomic-embed-text", "OpenRouter", "text-embedding-3-small", 10m, 0m, 0m, 0m, 0m, 0m));
        var gateway = Substitute.For<IAiGateway>();
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.TryReserveAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(false);
        var usageService = Substitute.For<IAiUsageService>();
        var sut = new AiTaskGateway(gateway, configService, usageService, budgetService, NullLogger<AiTaskGateway>.Instance);

        await Assert.ThrowsAsync<AiTaskBudgetExceededException>(() => sut.GenerateEmbeddingAsync(["hello"]));

        await gateway.DidNotReceiveWithAnyArgs().GenerateEmbeddingAsync(default!, default);
    }
}
