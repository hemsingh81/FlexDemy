namespace FlexDemy.Application.Settings;

// ChangedAt/ChangedBy, not CreatedAt/CreatedBy -- a mapper-level rename only (see SettingMapper),
// the underlying entity still stores these via AuditableEntity's columns.
public sealed record SettingChangeHistoryDto(
    string Id,
    string SettingId,
    string Key,
    string KeyType,
    string OldValue,
    string NewValue,
    DateTimeOffset ChangedAt,
    string? ChangedBy);
