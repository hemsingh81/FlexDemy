namespace FlexDemy.Application.Settings;

// CreatedAt/CreatedBy included alongside UpdatedAt/UpdatedBy -- AuditSaveChangesInterceptor only
// stamps UpdatedAt/UpdatedBy on EntityState.Modified, never on Added, so a seeded-but-never-edited
// Setting has null UpdatedAt/UpdatedBy. The frontend falls back to CreatedAt/CreatedBy so FR-5's
// "last-changed metadata" never renders blank for a row that's only ever been inserted.
public sealed record SettingDto(
    string Id,
    string Key,
    string Value,
    string KeyType,
    bool IsActive,
    DateTimeOffset CreatedAt,
    string? CreatedBy,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy);
