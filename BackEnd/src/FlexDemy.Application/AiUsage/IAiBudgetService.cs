namespace FlexDemy.Application.AiUsage;

public interface IAiBudgetService
{
    // Atomically reserves estimatedCost against the task's live budget threshold. Returns true if
    // reserved, false if it would exceed the threshold (or no budget row exists for taskId).
    Task<bool> TryReserveAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default);

    // Corrects a reservation to the real cost once it's known (actualCost - estimatedCost, which
    // may be negative or positive).
    Task SettleAsync(string taskId, decimal estimatedCost, decimal actualCost, CancellationToken cancellationToken = default);

    // Fully releases a reservation after a call failed entirely -- nothing was actually spent.
    Task ReleaseReservationAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default);

    // Throws NotFoundException if no budget row exists for taskId.
    Task<decimal> GetSpentAsync(string taskId, CancellationToken cancellationToken = default);

    // A task with no budget row is omitted from the result, not thrown -- callers building a list
    // across all tasks (AiConfigService.GetAllTaskConfigsAsync) must default a missing entry
    // themselves rather than have one task's seeding gap fail the whole list.
    Task<IReadOnlyDictionary<string, decimal>> GetAllSpentAsync(CancellationToken cancellationToken = default);
}
