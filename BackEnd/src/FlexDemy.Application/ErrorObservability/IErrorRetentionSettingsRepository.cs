using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF
// Core. Story 4.6: a single-row settings table -- GetAsync returns null if the row is somehow
// missing (e.g. seeding never ran) rather than throwing; callers fall back to FR-18's stated
// 180-day default.
public interface IErrorRetentionSettingsRepository
{
    Task<ErrorRetentionSettings?> GetAsync(CancellationToken cancellationToken = default);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    void Add(ErrorRetentionSettings settings);

    void Update(ErrorRetentionSettings settings);
}
