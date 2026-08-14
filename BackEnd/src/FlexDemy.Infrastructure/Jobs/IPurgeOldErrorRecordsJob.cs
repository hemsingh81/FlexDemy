namespace FlexDemy.Infrastructure.Jobs;

// Story 4.6/AC #5/FR-18. This codebase's first *recurring* Hangfire job -- registered via
// RecurringJob.AddOrUpdate in Program.cs, not enqueued per-request like ScanFileJob/ParseFileJob/
// ExtractStructureJob/PublishNodeContentJob.
public interface IPurgeOldErrorRecordsJob
{
    Task RunAsync(CancellationToken cancellationToken);
}
