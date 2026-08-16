using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Settings;

// Persistence-ignorant POCO (AD-4) -- no EF Core attributes here. Table/column mapping lives in
// Infrastructure/Persistence/Configurations/SettingConfiguration.cs. Generic Key/Value/KeyType
// store (AD-25) -- a bounded, named exception to AD-20's "explicit entities, not generic shape"
// rule, scoped to this small, flat, heterogeneous admin-config surface. Id/CreatedAt/etc. come
// from AuditableEntity.
public class Setting : AuditableEntity
{
    public required string Key { get; set; }
    public required string Value { get; set; }
    public required string KeyType { get; set; }
}
