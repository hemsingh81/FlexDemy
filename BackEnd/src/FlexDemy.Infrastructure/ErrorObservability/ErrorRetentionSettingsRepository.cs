using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.ErrorObservability;

// AD-24: placed under Infrastructure/ErrorObservability/, matching ErrorRecordRepository's own
// folder (the backend architecture spine names this folder for the whole ErrorObservability
// feature, not just ErrorRecord).
public class ErrorRetentionSettingsRepository(FlexDemyDbContext db) : IErrorRetentionSettingsRepository
{
    // Only one row is ever expected to exist -- FirstOrDefaultAsync, not a lookup by id.
    public Task<ErrorRetentionSettings?> GetAsync(CancellationToken cancellationToken = default) =>
        db.ErrorRetentionSettings.FirstOrDefaultAsync(cancellationToken);

    public void Add(ErrorRetentionSettings settings) => db.ErrorRetentionSettings.Add(settings);

    public void Update(ErrorRetentionSettings settings) => db.ErrorRetentionSettings.Update(settings);
}
