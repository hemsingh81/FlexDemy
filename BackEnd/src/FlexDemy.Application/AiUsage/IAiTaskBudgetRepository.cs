using FlexDemy.Domain.AiUsage;

namespace FlexDemy.Application.AiUsage;

// AD-18: unlike every other repository in this codebase, TryReserveAsync/AdjustSpentAsync issue
// raw SQL and commit immediately -- they do NOT stage a change for a later IUnitOfWork.SaveChangesAsync
// call. A single atomic UPDATE ... WHERE ... <= (SELECT ...) statement is the only way to reserve
// spend against a live threshold without racing under concurrent calls; EF's normal
// read-then-write change-tracking flow cannot do this atomically.
public interface IAiTaskBudgetRepository
{
    // Atomically reserves estimatedCost against the task's live AiTaskConfig.BudgetThreshold.
    // Returns true if reserved (spend was incremented), false if blocked (would exceed the
    // threshold, or no budget row exists for taskId).
    Task<bool> TryReserveAsync(string taskId, decimal estimatedCost, CancellationToken cancellationToken = default);

    // Unconditional spent += delta (delta may be negative). Used to settle a reservation to the
    // real cost after a successful call, or to fully release it after a failed one. No threshold
    // check -- the call already happened (or was fully released), there's nothing left to gate.
    // Returns the affected row count (0 if no budget row exists for taskId) so the caller can log
    // a silently-dropped correction instead of it vanishing with no trace (review finding, 2026-08-11).
    Task<int> AdjustSpentAsync(string taskId, decimal delta, CancellationToken cancellationToken = default);

    Task<AiTaskBudget?> GetByTaskIdAsync(string taskId, CancellationToken cancellationToken = default);

    Task<List<AiTaskBudget>> GetAllAsync(CancellationToken cancellationToken = default);
}
