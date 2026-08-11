using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiUsage;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AiUsage;

public class AiBudgetServiceTests
{
    private static AiBudgetService CreateSut(IAiTaskBudgetRepository? repository = null) =>
        new(repository ?? Substitute.For<IAiTaskBudgetRepository>(), NullLogger<AiBudgetService>.Instance);

    [Fact]
    public async Task TryReserveAsync_delegates_to_the_repository_and_returns_its_result()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.TryReserveAsync("explainTopic", 5m, Arg.Any<CancellationToken>()).Returns(true);
        var sut = CreateSut(repository);

        var reserved = await sut.TryReserveAsync("explainTopic", 5m);

        Assert.True(reserved);
    }

    [Fact]
    public async Task SettleAsync_adjusts_by_the_delta_between_actual_and_estimated()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.AdjustSpentAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(1);
        var sut = CreateSut(repository);

        // estimated 5, actual 3 -> release the 2 over-reserved.
        await sut.SettleAsync("explainTopic", estimatedCost: 5m, actualCost: 3m);

        await repository.Received(1).AdjustSpentAsync("explainTopic", -2m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SettleAsync_adds_more_when_actual_exceeds_the_estimate()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.AdjustSpentAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(1);
        var sut = CreateSut(repository);

        // estimated 5, actual 8 -> reserve 3 more.
        await sut.SettleAsync("explainTopic", estimatedCost: 5m, actualCost: 8m);

        await repository.Received(1).AdjustSpentAsync("explainTopic", 3m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReleaseReservationAsync_subtracts_the_full_estimate()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.AdjustSpentAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(1);
        var sut = CreateSut(repository);

        await sut.ReleaseReservationAsync("explainTopic", estimatedCost: 5m);

        await repository.Received(1).AdjustSpentAsync("explainTopic", -5m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReleaseReservationAsync_a_dropped_adjustment_still_calls_the_repository_correctly()
    {
        // AdjustSpentAsync returning 0 (no budget row exists) is logged, not thrown -- the call
        // itself must still complete normally rather than surfacing as a failure to the caller.
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.AdjustSpentAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>()).Returns(0);
        var sut = CreateSut(repository);

        await sut.ReleaseReservationAsync("explainTopic", estimatedCost: 5m);

        await repository.Received(1).AdjustSpentAsync("explainTopic", -5m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetSpentAsync_returns_the_matching_rows_spend()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.GetByTaskIdAsync("explainTopic", Arg.Any<CancellationToken>())
            .Returns(new AiTaskBudget { Id = "b1", TaskId = "explainTopic", Spent = 12.5m });
        var sut = CreateSut(repository);

        var spent = await sut.GetSpentAsync("explainTopic");

        Assert.Equal(12.5m, spent);
    }

    [Fact]
    public async Task GetSpentAsync_missing_row_throws_NotFoundException()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.GetByTaskIdAsync("explainTopic", Arg.Any<CancellationToken>()).Returns((AiTaskBudget?)null);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.GetSpentAsync("explainTopic"));
    }

    [Fact]
    public async Task GetAllSpentAsync_returns_a_dictionary_keyed_by_taskId()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new AiTaskBudget { Id = "b1", TaskId = "explainTopic", Spent = 12.5m },
            new AiTaskBudget { Id = "b2", TaskId = "defineKeyword", Spent = 3m },
        ]);
        var sut = CreateSut(repository);

        var all = await sut.GetAllSpentAsync();

        Assert.Equal(12.5m, all["explainTopic"]);
        Assert.Equal(3m, all["defineKeyword"]);
    }

    [Fact]
    public async Task GetAllSpentAsync_a_task_with_no_row_is_simply_omitted_not_thrown()
    {
        var repository = Substitute.For<IAiTaskBudgetRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new AiTaskBudget { Id = "b1", TaskId = "explainTopic", Spent = 12.5m },
        ]);
        var sut = CreateSut(repository);

        var all = await sut.GetAllSpentAsync();

        Assert.Single(all);
        Assert.False(all.ContainsKey("defineKeyword"));
    }
}
