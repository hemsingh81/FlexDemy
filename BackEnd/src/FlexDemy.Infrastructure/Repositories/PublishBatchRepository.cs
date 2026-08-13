using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class PublishBatchRepository(FlexDemyDbContext db) : IPublishBatchRepository
{
    public Task<PublishBatch?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.PublishBatches.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

    public Task<PublishBatch?> GetLatestByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        db.PublishBatches.Where(b => b.CourseId == courseId).OrderByDescending(b => b.CreatedAt).FirstOrDefaultAsync(cancellationToken);

    public Task<List<PublishBatchItem>> GetItemsByBatchIdAsync(string batchId, CancellationToken cancellationToken = default) =>
        db.PublishBatchItems.Where(i => i.BatchId == batchId).ToListAsync(cancellationToken);

    public Task<PublishBatchItem?> GetItemByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.PublishBatchItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

    public void AddBatch(PublishBatch batch) => db.PublishBatches.Add(batch);
    public void AddItem(PublishBatchItem item) => db.PublishBatchItems.Add(item);

    // Snake_case identifiers are load-bearing here -- .UseSnakeCaseNamingConvention() only affects
    // EF's own LINQ-to-SQL translation; raw SQL must spell out the real DB column names.
    // SqlQuery<int> (not ExecuteSqlInterpolatedAsync, which only returns an affected-row count) --
    // executed as a query so the RETURNING value comes back directly.
    //
    // Code-review patch: a single statement with two chained writable CTEs, both always executed
    // to completion by Postgres regardless of which branch of the final SELECT ends up reading
    // them (standard Postgres CTE semantics -- referenced writable CTEs always run exactly once).
    // `claim` atomically flips PublishBatchItem.DecrementCommitted only if it was still false --
    // an item that already claimed makes `claim` return 0 rows. `decremented` only runs the actual
    // -1 update if `claim` produced a row, so a repeated call for an already-claimed item performs
    // no further decrement (fixes the original bug: a Hangfire retry after this call itself throws
    // could otherwise never safely re-attempt the decrement, and calling it unconditionally would
    // double-decrement). The final SELECT always returns exactly one row: the freshly-decremented
    // value when this call was the one that claimed, or a plain fresh read of the current Remaining
    // otherwise -- so a caller whose own finalize step throws AFTER a successful decrement can
    // retry and still observe Remaining == 0 to retry finalizing, rather than the decrement being
    // invisible on every subsequent attempt.
    public async Task<int> DecrementRemainingAsync(string itemId, string batchId, CancellationToken cancellationToken = default)
    {
        var results = await db.Database
            .SqlQuery<int>($"""
                WITH claim AS (
                    UPDATE publish_batch_items
                    SET decrement_committed = true
                    WHERE id = {itemId} AND decrement_committed = false
                    RETURNING id
                ),
                decremented AS (
                    UPDATE publish_batches
                    SET remaining = remaining - 1
                    WHERE id = {batchId} AND EXISTS (SELECT 1 FROM claim)
                    RETURNING remaining
                )
                SELECT remaining FROM decremented
                UNION ALL
                SELECT remaining FROM publish_batches
                WHERE id = {batchId} AND NOT EXISTS (SELECT 1 FROM decremented)
                """)
            .ToListAsync(cancellationToken);

        return results.Single();
    }
}
