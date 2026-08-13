using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// DecrementRemainingAsync issues a raw `UPDATE ... RETURNING` (db.Database.SqlQuery<T>) which EF
// Core's InMemory provider cannot run at all -- confirmed directly: InMemory throws
// InvalidOperationException("Relational-specific methods can only be used when the context is
// using a relational database provider") on the call itself, not merely on translation. Same
// category of gap AiTaskBudgetRepositoryTests.cs already documents/excludes for its own raw-SQL
// methods, and BackEnd/CLAUDE.md's Testing section calls out generally. The atomicity AD-16 relies
// on ("exactly one caller ever observes remaining == 0") is a guarantee of Postgres executing a
// single UPDATE...RETURNING statement, not app-level logic -- there is nothing here for a
// mock-sequenced unit test to usefully reprove; it is exercised against real Postgres, not
// covered by these unit tests. PublishNodeContentJobTests.cs covers the app-level logic that
// actually branches on the returned value (finalize only when remaining == 0).
public class PublishBatchRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static PublishBatch MakeBatch(string id = "batch_1", string courseId = "course_1", int totalNodes = 3, int remaining = 3) => new()
    {
        Id = id,
        CourseId = courseId,
        TotalNodes = totalNodes,
        Remaining = remaining,
    };

    private static PublishBatchItem MakeItem(string id, string batchId, string? topicId = "topic_1", PublishItemStatus status = PublishItemStatus.Queued) => new()
    {
        Id = id,
        BatchId = batchId,
        TopicId = topicId,
        Status = status,
    };

    [Fact]
    public async Task GetByIdAsync_returns_the_matching_batch()
    {
        await using var db = NewContext();
        db.PublishBatches.Add(MakeBatch());
        await db.SaveChangesAsync();
        var repository = new PublishBatchRepository(db);

        var found = await repository.GetByIdAsync("batch_1");

        Assert.NotNull(found);
        Assert.Equal("course_1", found!.CourseId);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new PublishBatchRepository(db);

        Assert.Null(await repository.GetByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task GetLatestByCourseIdAsync_returns_the_most_recently_created_batch_for_that_course()
    {
        await using var db = NewContext();
        var older = MakeBatch(id: "batch_older", courseId: "course_1");
        var newer = MakeBatch(id: "batch_newer", courseId: "course_1");
        db.PublishBatches.AddRange(older, newer);
        await db.SaveChangesAsync();
        // CreatedAt is stamped by AuditSaveChangesInterceptor on SaveChangesAsync -- force an
        // explicit ordering so this test doesn't depend on same-tick timestamp collisions.
        older.CreatedAt = DateTime.UtcNow.AddMinutes(-10);
        newer.CreatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        var repository = new PublishBatchRepository(db);

        var latest = await repository.GetLatestByCourseIdAsync("course_1");

        Assert.NotNull(latest);
        Assert.Equal("batch_newer", latest!.Id);
    }

    [Fact]
    public async Task GetLatestByCourseIdAsync_returns_null_for_a_course_with_no_batches()
    {
        await using var db = NewContext();
        var repository = new PublishBatchRepository(db);

        Assert.Null(await repository.GetLatestByCourseIdAsync("course_with_no_batches"));
    }

    [Fact]
    public async Task GetLatestByCourseIdAsync_does_not_return_another_courses_batch()
    {
        await using var db = NewContext();
        db.PublishBatches.Add(MakeBatch(id: "batch_other", courseId: "course_other"));
        await db.SaveChangesAsync();
        var repository = new PublishBatchRepository(db);

        Assert.Null(await repository.GetLatestByCourseIdAsync("course_1"));
    }

    [Fact]
    public async Task GetItemsByBatchIdAsync_returns_every_item_for_that_batch_only()
    {
        await using var db = NewContext();
        db.PublishBatchItems.AddRange(
            MakeItem("item_1", "batch_1"),
            MakeItem("item_2", "batch_1", topicId: null),
            MakeItem("item_3", "batch_other"));
        await db.SaveChangesAsync();
        var repository = new PublishBatchRepository(db);

        var items = await repository.GetItemsByBatchIdAsync("batch_1");

        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Equal("batch_1", i.BatchId));
    }

    [Fact]
    public async Task GetItemByIdAsync_returns_the_matching_item()
    {
        await using var db = NewContext();
        db.PublishBatchItems.Add(MakeItem("item_1", "batch_1"));
        await db.SaveChangesAsync();
        var repository = new PublishBatchRepository(db);

        var found = await repository.GetItemByIdAsync("item_1");

        Assert.NotNull(found);
        Assert.Equal("batch_1", found!.BatchId);
    }

    [Fact]
    public async Task GetItemByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new PublishBatchRepository(db);

        Assert.Null(await repository.GetItemByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task AddBatch_stages_the_batch_for_the_next_SaveChangesAsync()
    {
        await using var db = NewContext();
        var repository = new PublishBatchRepository(db);

        repository.AddBatch(MakeBatch());
        await db.SaveChangesAsync();

        Assert.NotNull(await db.PublishBatches.FindAsync("batch_1"));
    }

    [Fact]
    public async Task AddItem_stages_the_item_for_the_next_SaveChangesAsync()
    {
        await using var db = NewContext();
        var repository = new PublishBatchRepository(db);

        repository.AddItem(MakeItem("item_1", "batch_1"));
        await db.SaveChangesAsync();

        Assert.NotNull(await db.PublishBatchItems.FindAsync("item_1"));
    }
}
