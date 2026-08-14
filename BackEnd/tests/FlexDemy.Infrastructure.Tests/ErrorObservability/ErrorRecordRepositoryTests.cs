using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Infrastructure.ErrorObservability;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.ErrorObservability;

public class ErrorRecordRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ErrorRecord MakeRecord(
        string id,
        ErrorCategory category = ErrorCategory.SystemInfrastructureError,
        ErrorPriority priority = ErrorPriority.P2,
        ErrorStatus status = ErrorStatus.New,
        ErrorSource source = ErrorSource.Backend,
        string message = "Something failed",
        string? exceptionType = null,
        DateTimeOffset? lastOccurredAt = null,
        string? correlationId = null) => new()
    {
        Id = id,
        Fingerprint = $"fp_{id}",
        Source = source,
        Category = category,
        Priority = priority,
        Status = status,
        Message = message,
        ExceptionType = exceptionType,
        OccurrenceCount = 1,
        FirstOccurredAt = lastOccurredAt ?? DateTimeOffset.UtcNow,
        LastOccurredAt = lastOccurredAt ?? DateTimeOffset.UtcNow,
        CorrelationId = correlationId,
    };

    [Fact]
    public async Task QueryAsync_with_no_filters_excludes_Archived_by_default()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", status: ErrorStatus.New),
            MakeRecord("err_2", status: ErrorStatus.Archived));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(new ErrorListQuery(), CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_with_IncludeArchived_true_includes_Archived_records()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", status: ErrorStatus.New),
            MakeRecord("err_2", status: ErrorStatus.Archived));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(new ErrorListQuery { IncludeArchived = true }, CancellationToken.None);

        Assert.Equal(2, totalCount);
        Assert.Equal(2, items.Count);
    }

    [Fact]
    public async Task QueryAsync_orders_newest_LastOccurredAt_first()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        db.ErrorRecords.AddRange(
            MakeRecord("err_older", lastOccurredAt: now.AddHours(-2)),
            MakeRecord("err_newest", lastOccurredAt: now),
            MakeRecord("err_middle", lastOccurredAt: now.AddHours(-1)));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery(), CancellationToken.None);

        Assert.Equal(["err_newest", "err_middle", "err_older"], items.Select(r => r.Id));
    }

    [Fact]
    public async Task QueryAsync_filters_by_Category()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", category: ErrorCategory.ExternalIntegrationError),
            MakeRecord("err_2", category: ErrorCategory.ValidationError));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { Category = ErrorCategory.ExternalIntegrationError }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_filters_by_Priority()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(MakeRecord("err_1", priority: ErrorPriority.P0), MakeRecord("err_2", priority: ErrorPriority.P3));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Priority = ErrorPriority.P0 }, CancellationToken.None);

        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_filters_by_Status_even_when_IncludeArchived_is_true()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", status: ErrorStatus.Resolved),
            MakeRecord("err_2", status: ErrorStatus.Archived));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(
            new ErrorListQuery { Status = ErrorStatus.Resolved, IncludeArchived = true }, CancellationToken.None);

        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    // Code-review patch: explicitly filtering Status = Archived must not be silently
    // cancelled out by the separate default "exclude Archived" clause when IncludeArchived is
    // left at its false default -- the two controls are independent in the UI (IncludeArchived
    // toggle vs. the Status dropdown, which lists Archived as a selectable value).
    [Fact]
    public async Task QueryAsync_filtering_by_Status_Archived_returns_Archived_rows_even_when_IncludeArchived_is_left_false()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_archived", status: ErrorStatus.Archived),
            MakeRecord("err_new", status: ErrorStatus.New));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { Status = ErrorStatus.Archived, IncludeArchived = false }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_archived", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_filters_by_Source()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(MakeRecord("err_1", source: ErrorSource.Frontend), MakeRecord("err_2", source: ErrorSource.Backend));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Source = ErrorSource.Frontend }, CancellationToken.None);

        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_filters_by_FromDate_and_ToDate_against_LastOccurredAt()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        db.ErrorRecords.AddRange(
            MakeRecord("err_too_old", lastOccurredAt: now.AddDays(-10)),
            MakeRecord("err_in_range", lastOccurredAt: now.AddDays(-5)),
            MakeRecord("err_too_new", lastOccurredAt: now));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(
            new ErrorListQuery { FromDate = now.AddDays(-7), ToDate = now.AddDays(-2) }, CancellationToken.None);

        Assert.Equal("err_in_range", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_Search_matches_Message()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", message: "Database connection timed out"),
            MakeRecord("err_2", message: "Validation failed"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Search = "connection" }, CancellationToken.None);

        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_Search_matches_ExceptionType()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_1", message: "boom", exceptionType: "NullReferenceException"),
            MakeRecord("err_2", message: "boom", exceptionType: "ValidationException"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Search = "NullReference" }, CancellationToken.None);

        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_Search_is_case_insensitive()
    {
        await using var db = NewContext();
        db.ErrorRecords.Add(MakeRecord("err_1", message: "Database Connection Timed Out"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Search = "connection" }, CancellationToken.None);

        Assert.Single(items);
    }

    // Story 4.7/AC #2: exact match, not substring -- the one filter in the feature that must not
    // use Contains/ILike, unlike the free-text Search filter above.
    [Fact]
    public async Task QueryAsync_filters_by_CorrelationId_with_an_exact_match()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_match", correlationId: "corr_abc123"),
            MakeRecord("err_other", correlationId: "corr_xyz789"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { CorrelationId = "corr_abc123" }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_match", Assert.Single(items).Id);
    }

    // Code-review patch (AC #3): the story's own worked example is a scan->parse->extract chain
    // producing 3 separate ErrorRecords sharing one CorrelationId -- proves the filter returns
    // every matching row together, not just proving a single match works.
    [Fact]
    public async Task QueryAsync_returns_every_record_sharing_the_same_CorrelationId()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_scan", correlationId: "corr_upload_1", category: ErrorCategory.FileProcessingError),
            MakeRecord("err_parse", correlationId: "corr_upload_1", category: ErrorCategory.ExternalIntegrationError),
            MakeRecord("err_extract", correlationId: "corr_upload_1", category: ErrorCategory.SystemInfrastructureError),
            MakeRecord("err_unrelated", correlationId: "corr_other_upload"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { CorrelationId = "corr_upload_1" }, CancellationToken.None);

        Assert.Equal(3, totalCount);
        Assert.Equal(["err_extract", "err_parse", "err_scan"], items.Select(r => r.Id).OrderBy(id => id));
    }

    // AC #2's explicit "not substring" requirement -- a record whose CorrelationId merely
    // *contains* the queried value must be excluded.
    [Fact]
    public async Task QueryAsync_CorrelationId_filter_excludes_a_record_whose_CorrelationId_only_contains_the_value_as_a_substring()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            MakeRecord("err_exact", correlationId: "corr_abc"),
            MakeRecord("err_superstring", correlationId: "corr_abc_extra"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { CorrelationId = "corr_abc" }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_exact", Assert.Single(items).Id);
    }

    // Code-review patch: a query value with incidental leading/trailing whitespace (a saved URL,
    // a non-UI caller -- the frontend's own input already trims before calling onChange, but the
    // repository is the authoritative filter layer) must still match.
    [Fact]
    public async Task QueryAsync_CorrelationId_filter_trims_the_query_value_before_comparing()
    {
        await using var db = NewContext();
        db.ErrorRecords.Add(MakeRecord("err_1", correlationId: "corr_abc123"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { CorrelationId = "  corr_abc123  " }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_1", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_CorrelationId_filter_ANDs_with_another_active_filter()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            // Matches both filters.
            MakeRecord("err_match", correlationId: "corr_shared", status: ErrorStatus.Resolved),
            // Right CorrelationId, wrong Status.
            MakeRecord("err_wrong_status", correlationId: "corr_shared", status: ErrorStatus.New),
            // Right Status, wrong CorrelationId.
            MakeRecord("err_wrong_correlation", correlationId: "corr_other", status: ErrorStatus.Resolved));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { CorrelationId = "corr_shared", Status = ErrorStatus.Resolved }, CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_match", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_combines_every_active_filter_with_AND()
    {
        await using var db = NewContext();
        db.ErrorRecords.AddRange(
            // Matches every filter below.
            MakeRecord("err_match", category: ErrorCategory.ExternalIntegrationError, priority: ErrorPriority.P0),
            // Right category, wrong priority.
            MakeRecord("err_wrong_priority", category: ErrorCategory.ExternalIntegrationError, priority: ErrorPriority.P3),
            // Right priority, wrong category.
            MakeRecord("err_wrong_category", category: ErrorCategory.ValidationError, priority: ErrorPriority.P0));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(
            new ErrorListQuery { Category = ErrorCategory.ExternalIntegrationError, Priority = ErrorPriority.P0 },
            CancellationToken.None);

        Assert.Equal(1, totalCount);
        Assert.Equal("err_match", Assert.Single(items).Id);
    }

    [Fact]
    public async Task QueryAsync_pages_the_result_and_reports_the_true_TotalCount()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 5; i++)
        {
            db.ErrorRecords.Add(MakeRecord($"err_{i}", lastOccurredAt: now.AddMinutes(-i)));
        }
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(new ErrorListQuery { Page = 2, PageSize = 2 }, CancellationToken.None);

        // Newest-first order is err_0, err_1, err_2, err_3, err_4 -- page 2 of size 2 skips the
        // first 2 (err_0, err_1) and takes the next 2.
        Assert.Equal(5, totalCount);
        Assert.Equal(["err_2", "err_3"], items.Select(r => r.Id));
    }

    // Code-review patch: a non-positive Page must not reach Skip() with a negative argument
    // (undefined/provider-dependent behavior on a real relational provider).
    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task QueryAsync_treats_a_non_positive_Page_the_same_as_page_1(int page)
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        db.ErrorRecords.AddRange(MakeRecord("err_newest", lastOccurredAt: now), MakeRecord("err_older", lastOccurredAt: now.AddMinutes(-1)));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Page = page, PageSize = 25 }, CancellationToken.None);

        Assert.Equal(["err_newest", "err_older"], items.Select(r => r.Id));
    }

    // Code-review patch: an unbounded PageSize lets any caller force a full-table read in one
    // request; a non-positive PageSize must not zero out (or invert) Take().
    [Fact]
    public async Task QueryAsync_clamps_an_oversized_PageSize_to_the_maximum()
    {
        await using var db = NewContext();
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 150; i++)
        {
            db.ErrorRecords.Add(MakeRecord($"err_{i}", lastOccurredAt: now.AddMinutes(-i)));
        }
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, totalCount) = await repository.QueryAsync(new ErrorListQuery { Page = 1, PageSize = 99_999 }, CancellationToken.None);

        Assert.Equal(150, totalCount);
        Assert.True(items.Count <= 100, $"Expected at most 100 items, got {items.Count}.");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task QueryAsync_treats_a_non_positive_PageSize_as_at_least_1(int pageSize)
    {
        await using var db = NewContext();
        db.ErrorRecords.Add(MakeRecord("err_1"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery { Page = 1, PageSize = pageSize }, CancellationToken.None);

        Assert.Single(items);
    }

    // Code-review patch: Skip/Take pagination is only stable across separate requests with a
    // fully deterministic sort -- two rows sharing the exact same LastOccurredAt (plausible: a
    // burst of related failures) would otherwise risk being duplicated across pages or dropped.
    [Fact]
    public async Task QueryAsync_uses_Id_as_a_stable_tie_breaker_for_rows_with_an_identical_LastOccurredAt()
    {
        await using var db = NewContext();
        var sameInstant = DateTimeOffset.UtcNow;
        db.ErrorRecords.AddRange(
            MakeRecord("err_b", lastOccurredAt: sameInstant),
            MakeRecord("err_a", lastOccurredAt: sameInstant),
            MakeRecord("err_c", lastOccurredAt: sameInstant));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var (items, _) = await repository.QueryAsync(new ErrorListQuery(), CancellationToken.None);

        Assert.Equal(["err_c", "err_b", "err_a"], items.Select(r => r.Id));
    }

    [Fact]
    public async Task GetByIdAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.ErrorRecords.Add(MakeRecord("err_1"));
        await db.SaveChangesAsync();
        var repository = new ErrorRecordRepository(db);

        var found = await repository.GetByIdAsync("err_1", CancellationToken.None);

        Assert.NotNull(found);
        Assert.Equal("err_1", found!.Id);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new ErrorRecordRepository(db);

        Assert.Null(await repository.GetByIdAsync("does_not_exist", CancellationToken.None));
    }
}
