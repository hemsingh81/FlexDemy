using FlexDemy.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-25: Key is unique per KeyType (composite index), not globally unique -- a future non-Font
// KeyType can reuse a Key name a Font setting has already claimed.
public class SettingConfiguration : IEntityTypeConfiguration<Setting>
{
    public void Configure(EntityTypeBuilder<Setting> builder)
    {
        builder.ToTable("settings");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasMaxLength(64);
        builder.Property(s => s.Key).HasMaxLength(64).IsRequired();
        builder.Property(s => s.KeyType).HasMaxLength(64).IsRequired();
        builder.Property(s => s.Value).HasMaxLength(256).IsRequired();

        builder.HasIndex(s => new { s.Key, s.KeyType }).IsUnique();

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
