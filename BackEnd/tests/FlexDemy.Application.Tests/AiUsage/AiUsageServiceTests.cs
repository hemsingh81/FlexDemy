using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using FlexDemy.Domain.AiUsage;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AiUsage;

public class AiUsageServiceTests
{
    private static AiTaskConfigDto MakeConfig(
        decimal priceIn = 2m, decimal priceOut = 4m, decimal fallbackPriceIn = 10m, decimal fallbackPriceOut = 20m) => new(
        AiTaskIds.ExplainTopic, "Groq", "llama-4-maverick", "OpenRouter", "claude-4-haiku", 80m, CurrentSpend: 0m,
        PricePerMillionInputTokens: priceIn, PricePerMillionOutputTokens: priceOut,
        FallbackPricePerMillionInputTokens: fallbackPriceIn, FallbackPricePerMillionOutputTokens: fallbackPriceOut);

    private static AiUsageService CreateSut(
        IAiTaskUsageRepository? repository = null, IAiConfigService? configService = null,
        IUnitOfWork? unitOfWork = null, IIdGenerator? idGenerator = null)
    {
        configService ??= Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(MakeConfig());
        idGenerator ??= Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("usage_1");

        return new AiUsageService(
            repository ?? Substitute.For<IAiTaskUsageRepository>(),
            configService,
            unitOfWork ?? Substitute.For<IUnitOfWork>(),
            idGenerator,
            NullLogger<AiUsageService>.Instance);
    }

    [Fact]
    public async Task RecordUsageAsync_computes_cost_from_the_tasks_configured_pricing()
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        var configService = Substitute.For<IAiConfigService>();
        configService.GetTaskConfigAsync(AiTaskIds.ExplainTopic, Arg.Any<CancellationToken>()).Returns(MakeConfig(priceIn: 2m, priceOut: 4m));
        var sut = CreateSut(repository, configService);

        // 1,000,000 prompt tokens * $2/M = $2.00; 500,000 completion tokens * $4/M = $2.00 -> $4.00 total.
        var returnedCost = await sut.RecordUsageAsync(AiTaskIds.ExplainTopic, "Groq", "llama-4-maverick", new AiGatewayUsage(1_000_000, 500_000, 1_500_000), isFallbackServed: false, courseId: null, tutorId: null);

        repository.Received(1).Add(Arg.Is<AiTaskUsage>(u => u.Cost == 4.0m && u.TaskId == AiTaskIds.ExplainTopic));
        // Story 1.8: the caller (AiTaskGateway) settles its budget reservation using this return
        // value -- it must match the exact cost that was actually persisted, not just be non-zero.
        Assert.Equal(4.0m, returnedCost);
    }

    [Fact]
    public async Task RecordUsageAsync_a_fallback_served_call_is_costed_using_the_fallback_price_pair_not_the_primary()
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        var configService = Substitute.For<IAiConfigService>();
        // Primary is priced at $2/$4 per million; fallback at $10/$20 per million -- a
        // fallback-served call must use the fallback rate, not silently reuse the primary's.
        configService.GetTaskConfigAsync(AiTaskIds.ExplainTopic, Arg.Any<CancellationToken>())
            .Returns(MakeConfig(priceIn: 2m, priceOut: 4m, fallbackPriceIn: 10m, fallbackPriceOut: 20m));
        var sut = CreateSut(repository, configService);

        // 1,000,000 prompt tokens * $10/M = $10.00; 500,000 completion tokens * $20/M = $10.00 -> $20.00 total.
        await sut.RecordUsageAsync(AiTaskIds.ExplainTopic, "OpenRouter", "claude-4-haiku", new AiGatewayUsage(1_000_000, 500_000, 1_500_000), isFallbackServed: true, courseId: null, tutorId: null);

        repository.Received(1).Add(Arg.Is<AiTaskUsage>(u => u.Cost == 20.0m));
    }

    [Fact]
    public async Task RecordUsageAsync_persists_provider_model_tokens_fallback_and_attribution()
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        var sut = CreateSut(repository);

        await sut.RecordUsageAsync(AiTaskIds.ExplainTopic, "OpenRouter", "claude-4-haiku", new AiGatewayUsage(10, 5, 15), isFallbackServed: true, courseId: "course_1", tutorId: "tutor_1");

        repository.Received(1).Add(Arg.Is<AiTaskUsage>(u =>
            u.Id == "usage_1" &&
            u.Provider == "OpenRouter" &&
            u.Model == "claude-4-haiku" &&
            u.PromptTokens == 10 &&
            u.CompletionTokens == 5 &&
            u.TotalTokens == 15 &&
            u.IsFallbackServed &&
            u.CourseId == "course_1" &&
            u.TutorId == "tutor_1"));
    }

    [Fact]
    public async Task RecordUsageAsync_commits_exactly_once()
    {
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var sut = CreateSut(unitOfWork: unitOfWork);

        await sut.RecordUsageAsync(AiTaskIds.ExplainTopic, "Groq", "llama-4-maverick", new AiGatewayUsage(1, 1, 2), isFallbackServed: false, courseId: null, tutorId: null);

        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("last7")]
    [InlineData("last30")]
    [InlineData("all")]
    public async Task GetUsageAsync_accepts_every_known_range(string range)
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        repository.GetSinceAsync(Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        var result = await sut.GetUsageAsync(range);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetUsageAsync_unknown_range_throws_ValidationException()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.GetUsageAsync("last90"));
    }

    [Fact]
    public async Task GetUsageAsync_all_passes_a_null_cutoff_to_the_repository()
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        repository.GetSinceAsync(Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        await sut.GetUsageAsync("all");

        await repository.Received(1).GetSinceAsync(null, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("last7", 7)]
    [InlineData("last30", 30)]
    public async Task GetUsageAsync_last7_and_last30_pass_a_cutoff_approximately_N_days_in_the_past(string range, int days)
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        DateTimeOffset? capturedCutoff = null;
        repository.GetSinceAsync(Arg.Do<DateTimeOffset?>(c => capturedCutoff = c), Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        await sut.GetUsageAsync(range);

        Assert.NotNull(capturedCutoff);
        var expected = DateTimeOffset.UtcNow.AddDays(-days);
        Assert.True(Math.Abs((expected - capturedCutoff!.Value).TotalSeconds) < 5);
    }

    [Fact]
    public async Task GetUsageAsync_maps_each_row_to_an_AiUsageEntryDto()
    {
        var repository = Substitute.For<IAiTaskUsageRepository>();
        var createdAt = new DateTimeOffset(2026, 8, 11, 10, 0, 0, TimeSpan.Zero);
        repository.GetSinceAsync(Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>()).Returns(
        [
            new AiTaskUsage { Id = "u1", TaskId = AiTaskIds.ExplainTopic, Provider = "Groq", Model = "llama-4-maverick", Cost = 1.5m, IsFallbackServed = true, CreatedAt = createdAt },
        ]);
        var sut = CreateSut(repository);

        var result = await sut.GetUsageAsync("all");

        var entry = Assert.Single(result);
        Assert.Equal(AiTaskIds.ExplainTopic, entry.TaskId);
        Assert.Equal(new DateOnly(2026, 8, 11), entry.Date);
        Assert.Equal(1.5m, entry.Cost);
        Assert.True(entry.IsFallbackServed);
    }
}
