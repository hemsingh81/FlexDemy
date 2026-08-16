using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper.
public static class SettingMapper
{
    public static SettingDto ToDto(this Setting entity) => new(
        entity.Id,
        entity.Key,
        entity.Value,
        entity.KeyType,
        entity.IsActive,
        entity.CreatedAt,
        entity.CreatedBy,
        entity.UpdatedAt,
        entity.UpdatedBy
    );

    public static FontPairingDefinitionDto ToDto(this FontPairingDefinition entity) => new(
        entity.Slug,
        entity.DisplayFont,
        entity.BodyFont,
        entity.MonoFont,
        entity.IsActive
    );

    public static FontSizeDefinitionDto ToDto(this FontSizeDefinition entity) => new(
        entity.Slug,
        entity.RootFontScale,
        entity.IsActive
    );

    public static TypographyCombinationDefinitionDto ToDto(this TypographyCombinationDefinition entity) => new(
        entity.Slug,
        entity.Label,
        entity.FontPairingSlug,
        entity.FontSizeSlug,
        entity.IsActive
    );

    public static SettingChangeHistoryDto ToDto(this SettingChangeHistory entity) => new(
        entity.Id,
        entity.SettingId,
        entity.Key,
        entity.KeyType,
        entity.OldValue,
        entity.NewValue,
        entity.CreatedAt,
        entity.CreatedBy
    );
}
