using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AiConfig;

public class AiConfigServiceTests
{
    private static AiTaskConfig MakeConfig(string taskId = AiTaskIds.DefineKeyword) => new()
    {
        Id = $"cfg_{taskId}",
        TaskId = taskId,
        Provider = "Groq",
        Model = "llama-4-maverick",
        FallbackProvider = "OpenRouter",
        FallbackModel = "claude-4-haiku",
        BudgetThreshold = 80m,
    };

    private static AiConfigService CreateSut(
        IAiTaskConfigRepository? repository = null, IAiBudgetService? budgetService = null, IUnitOfWork? unitOfWork = null)
    {
        if (budgetService is null)
        {
            budgetService = Substitute.For<IAiBudgetService>();
            budgetService.GetAllSpentAsync(Arg.Any<CancellationToken>())
                .Returns((IReadOnlyDictionary<string, decimal>)new Dictionary<string, decimal>());
            budgetService.GetSpentAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(0m);
        }

        return new(
            repository ?? Substitute.For<IAiTaskConfigRepository>(), budgetService,
            unitOfWork ?? Substitute.For<IUnitOfWork>(), NullLogger<AiConfigService>.Instance);
    }

    private static UpdateAiTaskConfigRequest ValidRequest(
        string provider = "Groq", string model = "llama-4-scout", string fallbackProvider = "OpenRouter", string fallbackModel = "gpt-4o-mini", decimal budgetThreshold = 10m) =>
        new(provider, model, fallbackProvider, fallbackModel, budgetThreshold);

    [Fact]
    public async Task GetAllTaskConfigsAsync_maps_real_per_task_spend_into_CurrentSpend()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeConfig(AiTaskIds.DefineKeyword), MakeConfig(AiTaskIds.Embeddings)]);
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.GetAllSpentAsync(Arg.Any<CancellationToken>()).Returns((IReadOnlyDictionary<string, decimal>)new Dictionary<string, decimal>
        {
            [AiTaskIds.DefineKeyword] = 42.5m,
            [AiTaskIds.Embeddings] = 3m,
        });
        var sut = CreateSut(repository, budgetService);

        var result = await sut.GetAllTaskConfigsAsync();

        Assert.Equal(42.5m, result.Single(r => r.TaskId == AiTaskIds.DefineKeyword).CurrentSpend);
        Assert.Equal(3m, result.Single(r => r.TaskId == AiTaskIds.Embeddings).CurrentSpend);
    }

    [Fact]
    public async Task GetAllTaskConfigsAsync_a_task_with_no_budget_row_defaults_CurrentSpend_to_zero_without_throwing()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeConfig(AiTaskIds.DefineKeyword)]);
        var budgetService = Substitute.For<IAiBudgetService>();
        // No entry for defineKeyword -- a budget-seeding gap, distinct from the AiTaskConfig one.
        budgetService.GetAllSpentAsync(Arg.Any<CancellationToken>())
            .Returns((IReadOnlyDictionary<string, decimal>)new Dictionary<string, decimal>());
        var sut = CreateSut(repository, budgetService);

        var result = await sut.GetAllTaskConfigsAsync();

        Assert.Equal(0m, result.Single().CurrentSpend);
    }

    [Fact]
    public async Task GetAllTaskConfigsAsync_orders_results_to_match_AiTaskIds_All()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        // Deliberately returned out of AiTaskIds.All order.
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeConfig(AiTaskIds.Embeddings), MakeConfig(AiTaskIds.DefineKeyword)]);
        var sut = CreateSut(repository);

        var result = await sut.GetAllTaskConfigsAsync();

        Assert.Equal(AiTaskIds.DefineKeyword, result[0].TaskId);
        Assert.Equal(AiTaskIds.Embeddings, result[1].TaskId);
    }

    [Fact]
    public async Task GetAllTaskConfigsAsync_omits_a_missing_task_without_throwing()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        // Only 1 of 2 known tasks has a row -- a seeding gap.
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns(AiTaskIds.All.Where(id => id != AiTaskIds.Embeddings).Select(id => MakeConfig(id)).ToList());
        var sut = CreateSut(repository);

        var result = await sut.GetAllTaskConfigsAsync();

        Assert.Equal(1, result.Count);
        Assert.DoesNotContain(result, dto => dto.TaskId == AiTaskIds.Embeddings);
    }

    [Fact]
    public async Task UpdateTaskConfigAsync_happy_path_updates_the_row_and_commits_once()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        var existing = MakeConfig();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(existing);
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var sut = CreateSut(repository, unitOfWork: unitOfWork);
        var request = new UpdateAiTaskConfigRequest("OpenRouter", "gpt-4o-mini", "Groq", "llama-4-scout", 100m);

        var result = await sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, request);

        Assert.Equal("OpenRouter", result.Provider);
        Assert.Equal("gpt-4o-mini", result.Model);
        Assert.Equal(100m, result.BudgetThreshold);
        repository.Received(1).Update(Arg.Is<AiTaskConfig>(c => c.Provider == "OpenRouter"));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateTaskConfigAsync_unknown_taskId_throws_ValidationException()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync("not-a-real-task", ValidRequest()));
    }

    [Fact]
    public async Task UpdateTaskConfigAsync_negative_BudgetThreshold_throws_ValidationException()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest(budgetThreshold: -5m)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateTaskConfigAsync_blank_Provider_throws_ValidationException(string blank)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest(provider: blank)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateTaskConfigAsync_blank_Model_throws_ValidationException(string blank)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest(model: blank)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateTaskConfigAsync_blank_FallbackProvider_throws_ValidationException(string blank)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest(fallbackProvider: blank)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateTaskConfigAsync_blank_FallbackModel_throws_ValidationException(string blank)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest(fallbackModel: blank)));
    }

    [Fact]
    public async Task UpdateTaskConfigAsync_missing_row_for_a_known_taskId_throws_NotFoundException()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns((AiTaskConfig?)null);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.UpdateTaskConfigAsync(AiTaskIds.DefineKeyword, ValidRequest()));
    }

    [Fact]
    public async Task GetTaskConfigAsync_returns_the_mapped_dto_for_a_known_taskId()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var sut = CreateSut(repository);

        var result = await sut.GetTaskConfigAsync(AiTaskIds.DefineKeyword);

        Assert.Equal(AiTaskIds.DefineKeyword, result.TaskId);
        Assert.Equal("Groq", result.Provider);
    }

    [Fact]
    public async Task GetTaskConfigAsync_maps_real_spend_into_CurrentSpend()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.GetSpentAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(17.25m);
        var sut = CreateSut(repository, budgetService);

        var result = await sut.GetTaskConfigAsync(AiTaskIds.DefineKeyword);

        Assert.Equal(17.25m, result.CurrentSpend);
    }

    [Fact]
    public async Task GetTaskConfigAsync_a_missing_budget_row_defaults_CurrentSpend_to_zero_without_throwing()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns(MakeConfig());
        var budgetService = Substitute.For<IAiBudgetService>();
        budgetService.GetSpentAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>())
            .Returns(Task.FromException<decimal>(new NotFoundException(nameof(AiTaskConfig), AiTaskIds.DefineKeyword)));
        var sut = CreateSut(repository, budgetService);

        var result = await sut.GetTaskConfigAsync(AiTaskIds.DefineKeyword);

        Assert.Equal(0m, result.CurrentSpend);
    }

    [Fact]
    public async Task GetTaskConfigAsync_unknown_taskId_throws_ValidationException()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.GetTaskConfigAsync("not-a-real-task"));
    }

    [Fact]
    public async Task GetTaskConfigAsync_missing_row_for_a_known_taskId_throws_NotFoundException()
    {
        var repository = Substitute.For<IAiTaskConfigRepository>();
        repository.GetByTaskIdAsync(AiTaskIds.DefineKeyword, Arg.Any<CancellationToken>()).Returns((AiTaskConfig?)null);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.GetTaskConfigAsync(AiTaskIds.DefineKeyword));
    }
}
