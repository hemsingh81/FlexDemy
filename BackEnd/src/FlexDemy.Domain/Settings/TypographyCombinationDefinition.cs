using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Settings;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/TypographyCombinationDefinitionConfiguration.cs.
// Story 6.5: a curated preset bundling a Font Pairing + Font Size together for one-click
// selection. FontPairingSlug/FontSizeSlug are references by value to an existing
// FontPairingDefinition.Slug/FontSizeDefinition.Slug -- not a DB foreign key (same no-FK
// convention SettingChangeHistory.SettingId already uses), validated at Apply-time instead
// (SettingsService.ApplyTypographyCombinationAsync). Inherited IsActive is the curated/decurated
// toggle, same convention as FontPairingDefinition/FontSizeDefinition. Id/CreatedAt/etc. come
// from AuditableEntity.
public class TypographyCombinationDefinition : AuditableEntity
{
    public required string Slug { get; set; }
    public required string Label { get; set; }
    public required string FontPairingSlug { get; set; }
    public required string FontSizeSlug { get; set; }
}
