using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using Hangfire;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Infrastructure.Jobs;

// AC #5/FR-18: the one deliberate hard-delete in this whole feature -- every other write in
// Epic 4 is additive/soft-state. New records are never touched; the repository query only ever
// selects Resolved/Archived rows.
public class PurgeOldErrorRecordsJob(
    IErrorRecordRepository errorRecordRepository,
    IErrorRetentionSettingsRepository retentionSettingsRepository,
    IUnitOfWork unitOfWork,
    ILogger<PurgeOldErrorRecordsJob> logger) : IPurgeOldErrorRecordsJob
{
    // Matches ErrorAdminService's own fallback -- used if the settings row is somehow missing.
    private const int DefaultRetentionDays = 180;

    // Code-review patch: an explicit, named retry count -- matches every other Hangfire job in
    // this codebase (ScanFileJob/ParseFileJob/ExtractStructureJob/PublishNodeContentJob all
    // declare [AutomaticRetry(Attempts = MaxAttempts)] rather than relying on Hangfire's
    // undocumented implicit default). This run is safe to retry: it re-queries candidates fresh
    // each attempt and only ever deletes rows still matching the cutoff at retry time.
    private const int MaxAttempts = 5;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var settings = await retentionSettingsRepository.GetAsync(cancellationToken);
        var retentionDays = settings?.RetentionDays ?? DefaultRetentionDays;
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-retentionDays);

        var candidates = await errorRecordRepository.GetPurgeCandidatesAsync(cutoffDate, cancellationToken);
        if (candidates.Count > 0)
        {
            errorRecordRepository.RemoveRange(candidates);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        logger.LogInformation("Purged {Count} error records older than {Cutoff}", candidates.Count, cutoffDate);
    }
}
