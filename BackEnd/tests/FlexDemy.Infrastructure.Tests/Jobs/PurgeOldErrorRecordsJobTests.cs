using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Infrastructure.ErrorObservability;
using FlexDemy.Infrastructure.Jobs;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Jobs;

public class PurgeOldErrorRecordsJobTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ErrorRecord MakeRecord(
        string id,
        ErrorStatus status,
        DateTimeOffset? resolvedAt = null,
        DateTimeOffset? archivedAt = null) => new()
    {
        Id = id,
        Fingerprint = $"fp_{id}",
        Source = ErrorSource.Backend,
        Category = ErrorCategory.SystemInfrastructureError,
        Priority = ErrorPriority.P2,
        Status = status,
        Message = "boom",
        OccurrenceCount = 1,
        FirstOccurredAt = DateTimeOffset.UtcNow,
        LastOccurredAt = DateTimeOffset.UtcNow,
        ResolvedAt = resolvedAt,
        ArchivedAt = archivedAt,
    };

    [Fact]
    public async Task RunAsync_deletes_a_Resolved_record_older_than_the_retention_window()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 30 });
        db.ErrorRecords.Add(MakeRecord("err_old", ErrorStatus.Resolved, resolvedAt: DateTimeOffset.UtcNow.AddDays(-31)));
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.Null(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_old"));
    }

    [Fact]
    public async Task RunAsync_does_not_delete_a_Resolved_record_within_the_retention_window()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 30 });
        db.ErrorRecords.Add(MakeRecord("err_recent", ErrorStatus.Resolved, resolvedAt: DateTimeOffset.UtcNow.AddDays(-10)));
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.NotNull(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_recent"));
    }

    [Fact]
    public async Task RunAsync_ages_an_Archived_record_from_ArchivedAt_not_ResolvedAt()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 30 });
        // A stale ResolvedAt from a prior lifecycle state must not influence an Archived record's
        // own age check -- only ArchivedAt matters once Status is Archived.
        db.ErrorRecords.Add(MakeRecord(
            "err_archived",
            ErrorStatus.Archived,
            resolvedAt: DateTimeOffset.UtcNow.AddDays(-90),
            archivedAt: DateTimeOffset.UtcNow.AddDays(-5)));
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.NotNull(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_archived"));
    }

    [Fact]
    public async Task RunAsync_deletes_an_Archived_record_older_than_the_retention_window()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 30 });
        db.ErrorRecords.Add(MakeRecord("err_old_archived", ErrorStatus.Archived, archivedAt: DateTimeOffset.UtcNow.AddDays(-31)));
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.Null(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_old_archived"));
    }

    [Fact]
    public async Task RunAsync_never_deletes_a_New_record_regardless_of_age()
    {
        await using var db = NewContext();
        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 30 });
        var oldRecord = MakeRecord("err_new", ErrorStatus.New);
        oldRecord.FirstOccurredAt = DateTimeOffset.UtcNow.AddDays(-365);
        oldRecord.LastOccurredAt = DateTimeOffset.UtcNow.AddDays(-365);
        db.ErrorRecords.Add(oldRecord);
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.NotNull(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_new"));
    }

    [Fact]
    public async Task RunAsync_falls_back_to_180_days_when_no_retention_settings_row_exists()
    {
        await using var db = NewContext();
        db.ErrorRecords.Add(MakeRecord("err_170_days", ErrorStatus.Resolved, resolvedAt: DateTimeOffset.UtcNow.AddDays(-170)));
        await db.SaveChangesAsync();
        var job = new PurgeOldErrorRecordsJob(new ErrorRecordRepository(db), new ErrorRetentionSettingsRepository(db), new UnitOfWork(db), Substitute.For<ILogger<PurgeOldErrorRecordsJob>>());

        await job.RunAsync(CancellationToken.None);

        Assert.NotNull(await db.ErrorRecords.FirstOrDefaultAsync(r => r.Id == "err_170_days"));
    }
}
