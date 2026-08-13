using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

public interface IPublishBatchRepository
{
    Task<PublishBatch?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    // Newest first -- backs the checklist status endpoint's "what's the current/most recent
    // publish batch for this course" lookup.
    Task<PublishBatch?> GetLatestByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
    Task<List<PublishBatchItem>> GetItemsByBatchIdAsync(string batchId, CancellationToken cancellationToken = default);
    Task<PublishBatchItem?> GetItemByIdAsync(string id, CancellationToken cancellationToken = default);

    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void AddBatch(PublishBatch batch);
    void AddItem(PublishBatchItem item);

    // AD-16: an atomic conditional UPDATE (raw SQL), same established pattern as
    // AiTaskBudgetRepository.TryReserveAsync/CourseFileRepository.TryClaimForMaterializationAsync
    // -- never a LINQ read-then-write, which would reopen the exact two-callers-both-see-1 race
    // this exists to prevent.
    //
    // Code-review patch: takes itemId (not just batchId) -- atomically claims this item's own
    // one-time decrement (via PublishBatchItem.DecrementCommitted) together with the batch-level
    // decrement in a single statement, so a call repeated for an item that already claimed is a
    // safe no-op rather than a double-decrement (the original bug: PublishNodeContentJob's own
    // idempotency guard is keyed on Status, which goes terminal BEFORE this call -- a Hangfire
    // retry after this call itself throws would otherwise never re-attempt the decrement at all,
    // permanently under-counting). ALWAYS returns the current Remaining value, even on a call that
    // didn't itself decrement, so a caller retrying after a downstream failure (e.g. the finalize
    // step below throwing) can still observe Remaining == 0 and retry finalizing.
    Task<int> DecrementRemainingAsync(string itemId, string batchId, CancellationToken cancellationToken = default);
}
