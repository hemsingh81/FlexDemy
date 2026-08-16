using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class SettingChangeHistoryRepository(FlexDemyDbContext db) : ISettingChangeHistoryRepository
{
    public void Add(SettingChangeHistory entity) => db.SettingChangeHistories.Add(entity);

    public async Task<IReadOnlyList<SettingChangeHistory>> GetBySettingIdAsync(
        string settingId, CancellationToken cancellationToken = default) =>
        await db.SettingChangeHistories
            .Where(h => h.SettingId == settingId)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(cancellationToken);
}
