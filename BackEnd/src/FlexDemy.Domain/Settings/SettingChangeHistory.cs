using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Settings;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/SettingChangeHistoryConfiguration.cs. AD-25: one row
// per Apply, inserted through the normal tracked Add()+SaveChangesAsync() path (Story 6.3's
// SettingsService.ApplyAsync) -- AuditSaveChangesInterceptor stamps CreatedAt/CreatedBy on it like
// any other AuditableEntity, which double as this row's "changed at"/"changed by" (see
// SettingChangeHistoryDto/SettingMapper for the rename). IsActive/UpdatedAt/UpdatedBy/IsDeleted
// come along for free from AuditableEntity and are never read -- this entity is append-only, never
// soft-deleted or reactivated.
public class SettingChangeHistory : AuditableEntity
{
    public required string SettingId { get; set; }
    public required string Key { get; set; }
    public required string KeyType { get; set; }
    public required string OldValue { get; set; }
    public required string NewValue { get; set; }
}
