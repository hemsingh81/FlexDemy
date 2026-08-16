using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

public interface ISettingChangeHistoryRepository
{
    // AD-11: stages only -- the caller (SettingsService.ApplyAsync) commits via
    // IUnitOfWork.SaveChangesAsync inside its own ExecuteInTransactionAsync block.
    void Add(SettingChangeHistory entity);

    // AC #2: reverse-chronological -- satisfied at the query, not left to the caller.
    Task<IReadOnlyList<SettingChangeHistory>> GetBySettingIdAsync(
        string settingId, CancellationToken cancellationToken = default);
}
