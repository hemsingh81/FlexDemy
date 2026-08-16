using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Settings;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/FontSizeDefinitionConfiguration.cs. One value field,
// not three like FontPairingDefinition -- a font-size scale is a single proportional root-scale
// factor, not several independently-meaningful roles (Story 6.4). Inherited IsActive is the
// curated/decurated toggle, same convention as FontPairingDefinition. Id/CreatedAt/etc. come from
// AuditableEntity.
public class FontSizeDefinition : AuditableEntity
{
    public required string Slug { get; set; }
    public required string RootFontScale { get; set; }
}
