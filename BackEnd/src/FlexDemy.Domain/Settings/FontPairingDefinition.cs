using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Settings;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/FontPairingDefinitionConfiguration.cs. AD-26: the
// curated catalog a Font Setting's Value must resolve against -- inherited IsActive is the
// curated/decurated toggle (removing a pairing from the curated list is an IsActive flip, not a
// row delete). Id/CreatedAt/etc. come from AuditableEntity.
public class FontPairingDefinition : AuditableEntity
{
    public required string Slug { get; set; }
    public required string DisplayFont { get; set; }
    public required string BodyFont { get; set; }
    public required string MonoFont { get; set; }
}
